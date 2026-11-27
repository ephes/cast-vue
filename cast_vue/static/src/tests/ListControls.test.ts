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
    const wrapper = mount(FilterForm, { props: { form, facetCounts } });
    const design = wrapper.findAll(".cv-chip").find((chip) => chip.text().startsWith("Design"))!;
    expect(design.attributes("aria-pressed")).toBe("false");
    await design.trigger("click");
    expect(last(wrapper)).toMatchObject({ category_facets: "design" });
    expect(form.category_facets).toBe("");

    await wrapper.setProps({ form: { ...emptyForm, category_facets: "design", search: "rare" } });
    expect(design.attributes("aria-pressed")).toBe("true");
    expect(wrapper.find(".cv-count").text()).toBe("1");
    await design.trigger("click");
    expect(last(wrapper)).toMatchObject({ category_facets: "", search: "rare" });

    await wrapper.findAll("button").find((button) => button.text() === "Clear all")!.trigger("click");
    expect(last(wrapper)).toMatchObject({ search: "", category_facets: "" });
  });

  test("search submits, months read newest first and long facet lists expand", async () => {
    const wrapper = mount(FilterForm, { props: { form: { ...emptyForm, tag_facets: "tag-14" }, facetCounts } });
    await wrapper.find("#id_search").setValue("django");
    await wrapper.find("form").trigger("submit");
    expect(last(wrapper)).toMatchObject({ search: "django", tag_facets: "tag-14" });

    const groups = wrapper.findAll("fieldset");
    const months = groups[2].findAll(".cv-chip").map((chip) => chip.text());
    expect(months[0]).toMatch(/2026/);
    expect(months[0]).not.toBe(months[1]);
    expect(groups[2].findAll(".cv-chip")[0].text()).toContain("1"); // 2026-11 first

    const tags = () => groups[1].findAll(".cv-chip");
    expect(tags()).toHaveLength(14); // 12, the selected one and "Show all"
    expect(tags().some((chip) => chip.text().startsWith("tag 14"))).toBe(true);
    await tags().at(-1)!.trigger("click");
    expect(tags()).toHaveLength(15);
  });

  test("the toggle discloses the panel", async () => {
    const wrapper = mount(FilterForm, { props: { form: { ...emptyForm }, facetCounts } });
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
