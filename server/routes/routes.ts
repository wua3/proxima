import { Router } from "../deps.ts";
import * as applicationController from "./controllers/applicationController.ts"
import * as notesController from "./controllers/notesController.ts"

const router = new Router();

/**
 * POST/PUT REQUESTS 
 */

// Application submission
router.post('/typeform/submit', applicationController.parseTypeForm);

// Update status (PUT request)
router.put('/applications/:applicationId', applicationController.updateStatus);

// Add questions to interview question list
router.post('/questions', notesController.questionCreate);

// Add interview notes to the application 
router.post('/applications/:applicationId/notes', notesController.addNotes);

/**
 * GET REQUESTS
 */
// Fetch all applications for the grid
router.get('/applications', applicationController.displayApplications);

// Fetch application responses and notes for a specific applicant
router.get('/applications/:applicationid', applicationController.getApplicationResponses);

// Fetch all questions 
router.get('/questions', notesController.getAllQuestions);

// Fetch questions for a specific applicant
router.get('/applications/:applicantid/questions', notesController.getQuestionsForApplicant);

export { router };