import { expect, test } from "vitest";
import { mount } from "@vue/test-utils";
import TranscriptPanel from "@/components/TranscriptPanel.vue";

const cues = [
  { start: 0, end: 5, speaker: "Mara", text: "Welcome to the show." },
  { start: 5, end: 9, speaker: "Mara", text: "Today: boring technology." },
  { start: 9, end: 14, speaker: "Tom", text: "I like boring." },
  { start: 14, end: 20, speaker: "Mara", text: "So do I." },
];

test("groups cues by speaker, marks the spoken cue and seeks on click", async () => {
  const wrapper = mount(TranscriptPanel, { props: { cues, currentTime: 6, active: true } });
  const runs = wrapper.findAll(".cv-transcript__run");
  expect(runs.map((run) => run.find(".cv-transcript__speaker").text())).toEqual(["Mara", "Tom", "Mara"]);
  expect(runs[0].findAll(".cv-transcript__cue")).toHaveLength(2);
  expect(wrapper.find(".cv-transcript__cue.is-active").text()).toBe("Today: boring technology.");
  expect(wrapper.findAll(".cv-transcript__run.is-active")).toHaveLength(1);

  await runs[1].find("button").trigger("click");
  await wrapper.findAll(".cv-transcript__cue")[3].trigger("click");
  expect(wrapper.emitted("seek")).toEqual([[9], [14]]);

  await wrapper.setProps({ active: false });
  expect(wrapper.find(".is-active").exists()).toBe(false);
});

test("search narrows the transcript and highlights matches", async () => {
  const wrapper = mount(TranscriptPanel, { props: { cues, currentTime: 0, active: false } });
  await wrapper.find("input").setValue("BORING");
  expect(wrapper.findAll(".cv-transcript__run")).toHaveLength(2);
  expect(wrapper.findAll("mark").map((mark) => mark.text())).toEqual(["boring", "boring"]);
  expect(wrapper.find('[role="status"]').text()).toBe("2 matches");
  await wrapper.find("input").setValue("nothing like this");
  expect(wrapper.find(".cv-transcript__runs").exists()).toBe(false);
  expect(wrapper.text()).toContain("Nothing in the transcript matches");
});

test("transcripts without speakers are split into paragraphs", () => {
  const plain = Array.from({ length: 20 }, (_, index) => ({ start: index, end: index + 1, speaker: "", text: `Line ${index}.` }));
  const wrapper = mount(TranscriptPanel, { props: { cues: plain, currentTime: 0, active: false } });
  expect(wrapper.findAll(".cv-transcript__run")).toHaveLength(3);
  expect(wrapper.find(".cv-transcript__speaker").exists()).toBe(false);
});
