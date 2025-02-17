import * as Koa from 'koa';
import { getRepository, Repository } from 'typeorm';
import {
  AcceptedCommitteeType,
  Application,
  ApplicationStatus
} from '../../database/entities/Application';
import {
  CommitteeChoice,
  CommitteeType
} from '../../database/entities/CommitteeChoice';

// import { send } from "../utils/smtpClient";
import { getNotes, getComments } from './notesController';
import axios from 'axios';

/**
 * Parsing is very specific to the kind of form we have right now.
 * For exampl, I am getting 'freshman', 'sophomore', etc. by splitting
 * the year field in the TypeForm. TODO: add typeform entries as a table
 * and generalize the parsing.
 * @param {request, response}
 */
const parseTypeFormWebHook = async ({ request, response }: Koa.Context) => {
  // populate application
  const application:
    | {
        form_response: { definition: { fields: any[] }; answers: any };
      }
    | any = request.body;

  await parseApplicant(application.form_response);

  response.body = 'Submission received!';
};

/**
 * Parse existing applicants from TypeForm
 * @param appicantObject
 */
const parseTypeFormResponses = async ({ response }: Koa.Context) => {
  const formId = process.env.TYPEFORM_ID;
  // get JSON from typeform
  const url = `https://api.typeform.com/forms/${formId}/responses`;

  const config = {
    headers: { Authorization: `Bearer ${process.env.TYPEFORM_TOKEN}` }
  };

  let applicants: any[] = [];
  await axios.get(url, config).then((res: { data: { items: any[] } }) => {
    applicants = res.data.items;
  });

  for (const applicantObject of applicants) {
    await parseApplicant(applicantObject);
  }

  response.body = 'Submission received!';
};

/**
 * Parses an applicant submission's object from TypeForm API. TypeForm JSON format is generic
 * for both WebHook and Reponses API - this function is used in both cases. Responses API is used to load
 * responses before the start-up of the application.
 * @param appicantObject
 */
const parseApplicant = async (applicantObject: { answers: any }) => {
  // Repositories
  const applicationRepo: Repository<Application> = getRepository(Application);
  const committeeChoiceRepo: Repository<CommitteeChoice> = getRepository(
    CommitteeChoice
  );

  const responses: any = {};
  applicantObject.answers.forEach((answer: any) => {
    // Map field reference name (set in TypeForm) to the response
    if (answer.type === 'choice') {
      responses[answer.field.ref] = answer.choice.label;
    } else if (answer.type === 'choices') {
      responses[answer.field.ref] = answer.choices.labels.map((c: string) =>
        c.toLowerCase()
      );
    } else {
      responses[answer.field.ref] = answer[answer.type];
    }
  });

  const existsingNum = await applicationRepo.count({
    email: responses.email
  });

  if (existsingNum === 0) {
    const newApplication: Application = applicationRepo.create({
      name: `${responses.firstName} ${responses.lastName}`,
      email: responses.email,
      year: responses.year.split(' ')[0].toLowerCase(),
      director: responses.director,
      status: ApplicationStatus.APPLIED,
      essay1: responses.essay1,
      essay2: responses.essay2,
      essay3: responses.essay3,
      resume_link: responses.resume_link,
      commitments: responses.commitments,
      attendedVH: responses.attendedVH,
      feedback: responses.feedback,
      github_link: responses.github_link,
      linkedin_link: responses.linkedin_link,
      social_link: responses.social_link,
      design_link: responses.design_link,
      source: responses.source,
      committee_accepted: AcceptedCommitteeType.UNDECIDED
    });

    await applicationRepo.save(newApplication);

    // Create committee relations for an applicant
    responses.committees.forEach((committee: CommitteeType) => {
      const committeeChoice: CommitteeChoice = committeeChoiceRepo.create({
        committee: committee,
        application: newApplication
      });
      committeeChoiceRepo.save(committeeChoice);
    });
  }
};

/**
 * Display all applications for the grid on the main page.
 * Resulting format of data in response:
 * [{
 *  id: number,
 *  name: string,
 *  email: string,
 *  year: string,
 *  director: bool,
 *  status: string,
 *  resume_link: string,
 *  committee_accepted: string
 * }]
 * @param {response}
 */
const displayApplications = async ({ response }: Koa.Context) => {
  // Application repository
  const applicationRepo: Repository<Application> = getRepository(Application);

  // Load applications with committees specified
  const applications: Application[] = await applicationRepo.find({
    select: [
      'id',
      'name',
      'email',
      'year',
      'director',
      'status',
      'resume_link',
      'committee_accepted'
    ],
    relations: ['committees'],
    order: {
      id: 'ASC'
    }
  });

  response.body = applications;
};

/**
 * Helper method that gets application responses, populated by the TypeForm webhook.
 * Return:
 *   {
 *    name: string,
 *    email: string,
 *    year: string,
 *    director: boolean,
 *    status: string,
 *    essay1: string,
 *    essay2: string,
 *    essay3: string,
 *    commitments: string,
 *    attendedVH: boolean,
 *    feedback: string,
 *    source: string
 *    resume_link: string | null,
 *    github_link: string | null,
 *    linkedin_link: string | null,
 *    social_link: string | null,
 *    design_link: string | null,
 *    committee_accepted: string | null,
 *    committees: {id: number, text: {committee: string}}[],
 *   }
 * @param applicationId
 */
const getApplicationResponse = async (
  applicationId: number
): Promise<Application | undefined> => {
  const applicationRepo: Repository<Application> = getRepository(Application);

  const application: Application | undefined = await applicationRepo.findOne(
    applicationId,
    {
      relations: ['committees']
    }
  );

  return application;
};

/**
 * body: number, representing applicationId
 * response:
 * {
 *  application: {
 *    name: string,
 *    email: string,
 *    year: string,
 *    director: boolean,
 *    status: string,
 *    essay1: string,
 *    essay2: string,
 *    essay3: string,
 *    commitments: string,
 *    attendedVH: boolean,
 *    feedback: string,
 *    source: string
 *    resume_link: string | null,
 *    github_link: string | null,
 *    linkedin_link: string | null,
 *    social_link: string | null,
 *    design_link: string | null,
 *    committee_accepted: string | null,
 *    committees: string[],
 *   },
 *  notes:
 *   [{
 *    interviewer_name: string,
 *    reliability: number [1-7],
 *    interest: number [1-7],
 *    teamwork: number [1-7],
 *    overall: number [1-7],
 *    thoughts: string,
 *    responses: [{question: string, description: string, specificity: string, note: string}]
 *   }],
 *  comments: [{commenter_name: string, content: string}]
 *  }
 */
const getApplicantData = async ({ params, response }: Koa.Context) => {
  const applicationId: number = (params.applicationId as unknown) as number;

  response.body = {
    application: await getApplicationResponse(applicationId),
    notes: await getNotes(applicationId),
    comments: await getComments(applicationId)
  };
};

/**
 * Send email based on status update.
 */
const sendEmail = async (email: string, status: string, committee?: string) => {
  // let emailMessage: string;
  // if (status === "accepted") {
  //   emailMessage = `Congratualations! You are accepted to ${committee} committee!`;
  // } else if (status === "rejected") {
  //   emailMessage =
  //     "Unfortunately, we were not able to extend the position on VH boar to you.";
  // } else if (status === "to_interview") {
  //   emailMessage = "Hey! Let's talk tomorrow 2pm CST.";
  // } else {
  //   console.log(
  //     "Wrong status passed to sending emails. We have no emails for this case."
  //   );
  //   return;
  // }
  // send(email, "VandyHacks Board Decision", emailMessage);
};

/**
 * ApplicationID and new status are sent in the body.
 * body: {status: string, committee?: string}
 */
const updateStatus = async ({ params, request, response }: Koa.Context) => {
  const body: { status: string; committee?: string } | any = request.body;

  const applicationId = (params.applicationId as unknown) as number;
  const newStatus: ApplicationStatus = body.status;
  const committee: AcceptedCommitteeType | undefined = body.committee;

  // Application repo
  const applicationRepo: Repository<Application> = getRepository(Application);

  // Get application to update
  const application: Application | undefined = await applicationRepo.findOne(
    applicationId,
    {
      select: ['id', 'status', 'email']
    }
  );

  if (application) {
    // Logic for emails
    sendEmail(application.email as string, newStatus);

    // Update status
    application.status = newStatus;

    // Update committees if accepted
    if (newStatus === ApplicationStatus.ACCEPTED && committee) {
      application.committee_accepted = committee;
    }

    await applicationRepo.save(application);

    response.body = `Successfully updated ${application.email} with new status: ${newStatus}`;
  } else {
    response.status = 404;
    response.body = {
      message: 'Application is not found'
    };
  }
};

export {
  parseTypeFormWebHook,
  parseTypeFormResponses,
  displayApplications,
  updateStatus,
  getApplicantData
};
