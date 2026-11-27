export function initFeedCopy(root: ParentNode = document): void {
  root.querySelectorAll("[data-cv-feed-copy]").forEach((row) => {
    const input = row.querySelector<HTMLInputElement>("[data-cv-copy-url]");
    const button = row.querySelector<HTMLButtonElement>("[data-cv-copy-button]");
    const label = button?.querySelector("[data-cv-copy-label]");
    const status = row.querySelector<HTMLElement>("[data-cv-copy-status]");
    if (!input || !button?.hidden || !label || !status) return;

    const copyLabel = label.textContent;
    button.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(input.value);
        label.textContent = status.dataset.copied ?? "";
        status.classList.add("cv-sr-only");
        status.textContent = label.textContent;
      } catch {
        input.hidden = false;
        input.focus();
        input.select();
        label.textContent = copyLabel;
        status.classList.remove("cv-sr-only");
        status.textContent = status.dataset.selected ?? "";
      }
    });
    button.hidden = false;
  });
}
