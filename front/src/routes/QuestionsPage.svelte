<script lang="ts">
  import {
    Button,
    DataTable,
    TextAreaSkeleton,
    Toolbar,
    ToolbarBatchActions,
    ToolbarContent
  } from 'carbon-components-svelte';
  import wretch from 'wretch';
  import { onMount } from 'svelte';
  import Add32 from 'carbon-icons-svelte/lib/Add32';
  import Delete16 from 'carbon-icons-svelte/lib/Delete16';

  import { API_URL } from '../config/api';
  import ConfirmationModal from '../components/ConfirmationModal.svelte';
  import AddQuestionModal from '../components/AddQuestionModal.svelte';
  import { capitalizeFirstLetter } from '../utils/filters';
  import { CommitteeType } from '../interfaces';
  import { showError } from '../stores/errors';
  import { authStore } from '../stores/auth.js';

  const { token } = authStore;

  let loading = true;
  let open = false;

  let contentValue = '';
  let descriptionValue = '';
  let committeeIndex = 0;

  let confirmationModal = false;
  const modalText = `Are you sure you want delete these questions?`;
  const modalHeading = 'Delete selected questions';

  const headers = [
    {
      key: 'specificity',
      value: 'Committee'
    },
    {
      key: 'content',
      value: 'Question'
    },
    {
      key: 'description',
      value: 'Description'
    }
  ];

  let rows = [];
  let committees = [
    { id: '8', text: 'general' },
    { id: '9', text: 'wrap up' }
  ];

  let selectedRowIds: string[] = [];

  const toggleModal = () => {
    open = !open;
  };

  const toggleConfirmationModal = () => {
    confirmationModal = !confirmationModal;
  };

  onMount(async () => {
    rows = await wretch(`${API_URL}/questions`)
      .auth(`Bearer ${$token}`)
      .options({ credentials: 'include', mode: 'cors' })
      .get()
      .json();
    loading = false;

    for (const [key, value] of Object.entries(CommitteeType)) {
      committees.push({ id: key, text: value });
    }
  });

  const addQuestion = async () => {
    const newQuestion = {
      content: contentValue,
      specificity: committees[committeeIndex].text,
      description: descriptionValue
    };
    loading = true;
    open = false;
    wretch(`${API_URL}/questions`)
      .auth(`Bearer ${$token}`)
      .options({ credentials: 'include', mode: 'cors' })
      .post(newQuestion)
      .json(newQuestion => {
        rows.push(newQuestion);
        contentValue = '';
        descriptionValue = '';
        loading = false;
      })
      .catch(() => {
        loading = false;
        showError();
      });
  };

  const deleteQuestions = async () => {
    loading = true;
    confirmationModal = false;
    selectedRowIds.forEach(selectedRowId => {
      wretch(`${API_URL}/questions/${selectedRowId}`)
        .auth(`Bearer ${$token}`)
        .options({ credentials: 'include', mode: 'cors' })
        .delete();
    });

    rows = rows.filter(({ id }) => !selectedRowIds.includes(id));
    selectedRowIds = [];
    loading = false;
  };
</script>

{#if loading}
  <TextAreaSkeleton />
{:else}
  <DataTable
    batchSelection
    bind:selectedRowIds
    sortable
    title="All Questions"
    {headers}
    {rows}>
    <Toolbar>
      <ToolbarBatchActions>
        <Button icon={Delete16} on:click={toggleConfirmationModal}>
          Delete
        </Button>
      </ToolbarBatchActions>
      <ToolbarContent>
        <Button size="default" icon={Add32} kind="ghost" on:click={toggleModal}>
          Add Question
        </Button>
      </ToolbarContent>
    </Toolbar>
    <span slot="cell" let:row let:cell>
      {#if cell.key === 'specificity'}
        {capitalizeFirstLetter(cell.value)}
      {:else}{cell.value}{/if}
    </span>
    <AddQuestionModal
      bind:descriptionValue
      bind:contentValue
      bind:open
      bind:selectedIndex={committeeIndex}
      items={committees}
      {addQuestion}
      {toggleModal} />
  </DataTable>
  <ConfirmationModal
    bind:open={confirmationModal}
    onSubmit={deleteQuestions}
    {toggleConfirmationModal}
    {modalText}
    {modalHeading} />
{/if}
