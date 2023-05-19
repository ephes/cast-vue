<template>
    <form @submit.prevent="submitForm">
      <p>
        <label for="id_search">Search:</label>
        <input v-model="form.search" id="id_search" />
      </p>
      <p>
        <label>Date:</label>
        <input type="date" v-model="form.date_after" placeholder="YYYY/MM/DD" id="id_date_0">
        -
        <input type="date" v-model="form.date_before" placeholder="YYYY/MM/DD" id="id_date_1">
      </p>
      <p>
        <label for="id_date_facets">Date Facets:</label>
        <input v-model="form.date_facets" id="id_date_facets" />
      </p>
      <p>
        <label for="id_o">Ordering:</label>
        <select v-model="form.o" name="o" id="id_o">
          <option value="">---------</option>
          <option value="visible_date">Date</option>
          <option value="-visible_date">Date (descending)</option>
        </select>
      </p>
      <button type="submit">Filter</button>
    </form>
  </template>

  <script lang="ts">
  import { ref } from 'vue';

  interface Form {
    search: string;
    date_after: string;
    date_before: string;
    date_facets: string;
    o: string;
  }

  export default {
    setup(_, context) {
      const form = ref<Form>({
        search: '',
        date_after: '',
        date_before: '',
        date_facets: '',
        o: '',
      });

      const submitForm = () => {
        // handle form submission here
        console.log(form.value);
        context.emit("submitFilterForm", form.value);
      };

      return { form, submitForm };
    },
    emits: ["submitFilterForm"],
  };
  </script>
