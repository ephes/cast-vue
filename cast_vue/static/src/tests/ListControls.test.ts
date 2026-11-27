import { describe, expect, test } from "vitest";
import { mount } from "@vue/test-utils";
import FilterForm from "@/components/FilterForm.vue";
import PaginationButtons from "@/components/PaginationButtons.vue";

const facetCounts = {
  category_facets: [{ slug: "design", name: "Design", count: 3 }],
  tag_facets: Array.from({ length: 15 }, (_, index) => ({ slug: `tag-${index}`, name: `tag ${index}`, count: 1 })),
  date_facets: [{ slug: "2026-10", name: "2026-10", count: 2 }, { slug: "2026-11", name: "2026-11", count: 1 }],
};
const emptyForm = { search: "", date_after: "", date_before: "", date_facets: "", category_facets: "", tag_facets: "", order: "", page: 1 };
const last = (wrapper: ReturnType<typeof mount>) => wrapper.emitted("submitFilterForm")!.at(-1)![0];

describe("FilterForm.vue", () => {
  test("facet chips apply and release a filter without touching the applied form", async () => {
    const form = { ...emptyForm };
    const wrapper = mount(FilterForm, { props: { form, facetCounts, dateRangeEnabled: true } });
    const design = wrapper.findAll(".cv-chip").find((chip) => chip.text().startsWith("Design"))!;
    expect(design.attributes("aria-pressed")).toBe("false");
    await design.trigger("click");
    expect(last(wrapper)).toMatchObject({ category_facets: "design" });
    expect(form.category_facets).toBe("");

    await wrapper.setProps({ form: { ...emptyForm, category_facets: "design", search: "rare" } });
    expect(design.attributes("aria-pressed")).toBe("true");
    expect(wrapper.find(".cv-count").text()).toBe("2");
    await design.trigger("click");
    expect(last(wrapper)).toMatchObject({ category_facets: "", search: "rare" });

  });

  test("tag finder and full list show counts, and a rare selected tag is a removable chip", async () => {
    const wrapper = mount(FilterForm, { props: { form: { ...emptyForm, tag_facets: "tag-9" }, facetCounts, dateRangeEnabled: true } });
    const tags = wrapper.findAll("fieldset").find((group) => group.get("legend").text() === "Tags")!;
    expect(tags.findAll(".cv-chip")).toHaveLength(9);
    const selected = tags.get('button.cv-chip[aria-pressed="true"]');
    expect(selected.text()).toContain("tag 9");
    await selected.trigger("click");
    expect(last(wrapper)).toMatchObject({ tag_facets: "" });

    const finder = tags.get('[placeholder="Find a tag"]');
    await finder.setValue("AG 14");
    const result = tags.get('[aria-label="Matching tags"] button');
    expect(result.text()).toBe("tag 14 1");
    await result.trigger("click");
    expect(last(wrapper)).toMatchObject({ tag_facets: "tag-14" });
    await finder.setValue("missing");
    expect(tags.get('[role="status"]').text()).toBe("No matching tags.");

    const all = tags.get("details");
    expect(all.attributes("open")).toBeUndefined();
    expect(all.get("summary").text()).toBe("All 15 tags");
    expect(all.findAll(".cv-facet-option")).toHaveLength(15);
    expect(all.findAll(".cv-chip")).toHaveLength(0);
    wrapper.unmount();
  });

  test("year and month controls update the query and custom range stays independent", async () => {
    const wrapper = mount(FilterForm, { props: { form: emptyForm, facetCounts, dateRangeEnabled: true } });
    const year = wrapper.get(".cv-archive__years button");
    expect(year.text()).toContain("2026");
    expect(year.text()).toContain("3");
    expect(year.attributes("aria-expanded")).toBe("false");
    await year.trigger("click");
    expect(last(wrapper)).toMatchObject({ date_facets: "", date_after: "2026-01-01", date_before: "2026-12-31" });
    await wrapper.setProps({ form: { ...emptyForm, date_after: "2026-01-01", date_before: "2026-12-31" } });
    expect(year.attributes("aria-expanded")).toBe("true");
    const months = wrapper.findAll(".cv-archive__months button");
    expect(months.map((month) => month.text())).toEqual(["Nov 1", "Oct 2"]);
    await months[0].trigger("click");
    expect(last(wrapper)).toMatchObject({ date_facets: "2026-11", date_after: "", date_before: "" });
    await wrapper.setProps({ form: { ...emptyForm, date_facets: "2026-11" } });
    expect(year.attributes("aria-expanded")).toBe("true");
    expect(months[0].attributes("aria-pressed")).toBe("true");
    expect(wrapper.get(".cv-filters__dates").element.closest("details")?.open).toBe(false);
    await wrapper.get("#id_date_0").setValue("2024-04-01");
    await wrapper.get(".cv-filters__dates").trigger("submit");
    expect(last(wrapper)).toMatchObject({ date_facets: "", date_after: "2024-04-01", date_before: "" });

    await wrapper.get("#id_search").setValue("django");
    await wrapper.get(".cv-search").trigger("submit");
    expect(last(wrapper)).toMatchObject({ search: "django", date_facets: "2026-11" });
    wrapper.unmount();
  });

  test("without a range filter, years only disclose months", async () => {
    const wrapper = mount(FilterForm, { props: { form: emptyForm, facetCounts, dateRangeEnabled: false } });
    const year = wrapper.get(".cv-archive__years button");
    expect(year.attributes("aria-pressed")).toBeUndefined();
    expect(wrapper.find(".cv-filters__dates").exists()).toBe(false);
    expect(year.attributes("aria-expanded")).toBe("false");
    await year.trigger("click");
    expect(year.attributes("aria-expanded")).toBe("true");
    expect(wrapper.emitted("submitFilterForm")).toBeUndefined();
    await year.trigger("click");
    expect(wrapper.find(".cv-archive__months").exists()).toBe(false);

    await year.trigger("click");
    const month = wrapper.get(".cv-archive__months button");
    await month.trigger("click");
    expect(last(wrapper)).toMatchObject({ date_facets: "2026-11", date_after: "", date_before: "" });
    await wrapper.setProps({ form: { ...emptyForm, date_facets: "2026-11" } });
    expect(month.attributes("aria-pressed")).toBe("true");
    await year.trigger("click");
    expect(wrapper.emitted("submitFilterForm")).toHaveLength(1);
    expect(wrapper.find(".cv-archive__months").exists()).toBe(false);
    wrapper.unmount();
  });

  test("shows a custom order in the sort control", () => {
    const wrapper = mount(FilterForm, {
      props: { form: { ...emptyForm, order: "title" }, facetCounts, dateRangeEnabled: true },
    });
    const sort = wrapper.get<HTMLSelectElement>("select");
    expect(sort.element.value).toBe("title");
    expect(sort.element.selectedOptions[0].textContent).toBe("Order: title");
    wrapper.unmount();
  });

  test("the toggle discloses the panel", async () => {
    const wrapper = mount(FilterForm, { props: { form: { ...emptyForm }, facetCounts, dateRangeEnabled: true } });
    const toggle = wrapper.find(".cv-filters__toggle");
    const panel = wrapper.find(".cv-filters__panel");
    expect(toggle.attributes("aria-controls")).toBe(panel.attributes("id"));
    expect(panel.attributes("hidden")).toBeDefined();
    await toggle.trigger("click");
    expect(toggle.attributes("aria-expanded")).toBe("true");
    expect(panel.attributes("hidden")).toBeUndefined();
  });
});

describe("PaginationButtons.vue", () => {
  test("shows pages around the current one and emits page deltas", async () => {
    const wrapper = mount(PaginationButtons, { props: { currentPage: 5, totalPages: 12 } });
    const pages = wrapper.findAll(".cv-pagination__pages li").map((item) => item.text());
    expect(pages).toEqual(["1", "…", "4", "5", "6", "…", "12"]);
    expect(wrapper.find('[aria-current="page"]').text()).toBe("5");
    await wrapper.findAll(".cv-pagination__page").find((page) => page.text() === "12")!.trigger("click");
    await wrapper.find('[aria-current="page"]').trigger("click");
    const [prev, next] = [wrapper.findAll("button")[0], wrapper.findAll("button").at(-1)!];
    await prev.trigger("click");
    await next.trigger("click");
    expect(wrapper.emitted("change-page")).toEqual([[7], [-1], [1]]);
  });

  test("fills single-page gaps and disables the ends", () => {
    const wrapper = mount(PaginationButtons, { props: { currentPage: 1, totalPages: 4 } });
    expect(wrapper.findAll(".cv-pagination__pages li").map((item) => item.text())).toEqual(["1", "2", "3", "4"]);
    expect(wrapper.findAll("button")[0].attributes("disabled")).toBeDefined();
    expect(wrapper.findAll("button").at(-1)!.attributes("disabled")).toBeUndefined();
  });
});
