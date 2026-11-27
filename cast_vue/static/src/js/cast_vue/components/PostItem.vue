<template>
  <article class="post-item cv-post" :class="detail ? 'cv-post--detail' : 'cv-post--card'">
    <header class="cv-post__header" :class="{ 'cv-post__header--cover': coverUrl }">
      <img
        v-if="coverUrl"
        class="cv-post__cover"
        :src="coverUrl"
        :alt="detail ? (post.cover_alt_text || '') : ''"
        width="512"
        height="512"
        :loading="detail ? 'eager' : 'lazy'"
        decoding="async"
      />
      <p class="cv-post__meta cv-eyebrow">
        <time v-if="dateLabel" :datetime="articleData.articleDateTime || post.visible_date">{{ dateLabel }}</time>
        <template v-if="articleData.articleAuthor">
          <span aria-hidden="true"> · </span>by <span class="author">{{ articleData.articleAuthor }}</span>
        </template>
      </p>
      <h1 v-if="detail" class="cv-post__title">{{ post.title }}</h1>
      <h2 v-else class="cv-post__title">
        <router-link
          v-if="useRouterLink"
          :to="{ name: 'PostDetail', params: { slug: post.meta.slug } }"
        >{{ post.title }}</router-link>
        <a v-else :href="postLink">{{ post.title }}</a>
      </h2>
    </header>
    <!-- Audio players: full on the post page, a play button in lists -->
    <div v-if="detail && showPodlovePlayers && podlovePlayers.length > 0" class="cv-post__players">
      <audio-player
        v-for="([elementId, apiUrl]) in podlovePlayers"
        :key="elementId"
        :element-id="elementId"
        :api-url="apiUrl"
        :player-config="apiPodlovePlayerConfigUrl"
        :title="post.title"
        :slug="post.meta.slug"
      ></audio-player>
    </div>
    <div
      ref="body"
      class="cv-post__body cv-prose"
      v-html="detail ? detailHtml : overviewHtml"
      @click="handleClick"
      @keydown.enter="handleActivationKey"
      @keydown.space="handleActivationKey"
    ></div>
    <div v-if="!detail && showPodlovePlayers && podlovePlayers.length > 0" class="cv-post__players">
      <audio-player
        v-for="([elementId, apiUrl]) in podlovePlayers"
        :key="elementId"
        variant="compact"
        :element-id="elementId"
        :api-url="apiUrl"
        :player-config="apiPodlovePlayerConfigUrl"
        :title="post.title"
        :slug="post.meta.slug"
      ></audio-player>
    </div>
    <template v-if="!detail">
      <router-link
        v-if="useRouterLink"
        class="cv-post__more"
        :to="{ name: 'PostDetail', params: { slug: post.meta.slug } }"
        :aria-label="`${moreLabel}: ${post.title}`"
      >{{ moreLabel }} <cv-icon name="arrowRight" /></router-link>
    </template>
    <!-- Comments -->
    <section v-if="post.comments" class="comments cv-comments" aria-labelledby="cv-comments-title">
      <h2 id="cv-comments-title" class="cv-comments__title">
        Comments<template v-if="post.comments.length > 0"> ({{ post.comments.length }})</template>
      </h2>
      <comment-list
        :comments="post.comments"
        :commentMeta="commentMeta"
        @comment-posted="handleCommentPosted">
      </comment-list>
    </section>
    <!-- Modal for Images / Galleries -->
    <div
      v-if="isModalOpen"
      id="modal-div"
      ref="modal"
      class="modal"
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
      @click="handleModalClick"
      @keydown.tab="trapFocus"
    >
      <button type="button" class="close modal__button modal__button--close" aria-label="Close image viewer" @click.stop="closeModal">
        <cv-icon name="close" />
      </button>
      <button v-if="modalImage.prev" type="button" class="modal__button modal__button--prev" aria-label="Previous image" @click.stop="showNeighbour('prev')">
        <cv-icon name="left" />
      </button>
      <button v-if="modalImage.next" type="button" class="modal__button modal__button--next" aria-label="Next image" @click.stop="showNeighbour('next')">
        <cv-icon name="right" />
      </button>
      <picture>
        <source
          :srcset="modalSource.srcset"
          :src="modalSource.src"
          :type="modalSource.type"
          :sizes="modalSource.sizes"
        />
        <img
          id="modal-image"
          class="modal-content"
          :src="modalImage.src"
          :srcset="modalImage.srcset"
          :sizes="modalImage.sizes"
          :next="modalImage.next"
          :prev="modalImage.prev"
          :alt="modalImage.alt || 'Full-sized image'"
          title="Open the full-sized image in a new tab"
        />
      </picture>
      <p v-if="modalImage.alt" class="modal__caption">{{ modalImage.alt }}</p>
    </div>
  </article>
</template>

<script lang="ts">
import config from '../config';
import { Post, ModalImage, ModalSource, CommentMeta, ArticleData } from "./types";
import CommentList from "./CommentList.vue";
import { resolveHttpUrl } from "../player/episode";
import AudioPlayer from "./AudioPlayer.vue";
import CvIcon from "./CvIcon.vue";


export default {
  mounted() {
    // Add event listener when the component is mounted
    window.addEventListener("keydown", this.handleKeyDown);
    this.enhanceGalleryImages();
  },
  updated() {
    this.enhanceGalleryImages();
  },
  beforeUnmount() {
    // Remove event listener when the component is unmounted
    window.removeEventListener("keydown", this.handleKeyDown);
    this.lockScroll(false);
  },
  emits: ["comment-posted"],
  name: "PostItem",
  components: {
    CommentList,
    AudioPlayer,
    CvIcon,
  },
  props: {
    post: {
      type: Object as () => Post,
      required: true,
    },
    detail: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      isModalOpen: false,
      modalImage: {} as ModalImage,
      modalSource: {} as ModalSource,
      // Thumbnail that opened the viewer; focus returns to it on close.
      modalOpener: null as HTMLElement | null,
    };
  },
  methods: {
    handleCommentPosted(target: Pick<CommentMeta, 'content_type' | 'object_pk'>) {
      if (target.content_type !== this.commentMeta.content_type || target.object_pk !== this.commentMeta.object_pk) return;
      this.$emit("comment-posted", this.post.id);
    },
    handleClick(e: Event) {
      // console.log("handleClick: ", e);
      if (!e.target) {
        return;
      }
      const clickedEl = e.target as HTMLImageElement;
      if (!(clickedEl.id)) {
        return;
      }
      if (!clickedEl.id.startsWith("gallery-image")) {
        return;
      }
      this.setModalFromImage(clickedEl);
    },
    // Enter or Space on a gallery thumbnail opens the viewer.
    handleActivationKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target?.id?.startsWith("gallery-image")) {
        // No page scroll, and the key must not also press the focused close button.
        e.preventDefault();
        this.handleClick(e);
      }
    },
    // Gallery thumbnails arrive as plain images: make them keyboard operable.
    enhanceGalleryImages() {
      const body = this.$refs.body as HTMLElement | undefined;
      body?.querySelectorAll<HTMLImageElement>('img[id^="gallery-image"]').forEach((image) => {
        if (image.tabIndex === 0) return;
        image.tabIndex = 0;
        image.setAttribute("role", "button");
        image.setAttribute("aria-label", `View image${image.alt ? ": " + image.alt : ""}`);
      });
    },
    lockScroll(locked: boolean) {
      document.documentElement.style.overflow = locked ? "hidden" : "";
    },
    showNeighbour(direction: "prev" | "next") {
      const target = this.modalImage[direction];
      if (!target) return;
      const image = document.getElementById("gallery-image-" + target.split("-")[1]) as HTMLImageElement | null;
      if (image) this.setModalFromImage(image);
    },
    trapFocus(event: KeyboardEvent) {
      const modal = this.$refs.modal as HTMLElement | undefined;
      const buttons = Array.from(modal?.querySelectorAll<HTMLElement>("button") ?? []);
      if (buttons.length === 0) return;
      const index = buttons.indexOf(document.activeElement as HTMLElement);
      const next = event.shiftKey ? (index <= 0 ? buttons.length - 1 : index - 1) : (index === buttons.length - 1 ? 0 : index + 1);
      event.preventDefault();
      buttons[next].focus();
    },
    setModalFromImage(clickedEl: HTMLImageElement) {
      const picture = clickedEl.parentNode as HTMLPictureElement;
      const source = picture.querySelector('source');
      // An image may lack some modal attributes: never keep the previous image's values.
      this.modalImage = {} as ModalImage;
      this.modalSource = {} as ModalSource;

      const sourceAttributes = [
        { attr: "data-modal-srcset", prop: "srcset" },
        { attr: "data-modal-src", prop: "src" },
        { attr: "type", prop: "type" },
        { attr: "data-modal-sizes", prop: "sizes" },
      ];

      for (const { attr, prop } of sourceAttributes) {
        const value = source?.getAttribute(attr);
        if (value) {
          this.modalSource[prop as keyof ModalSource] = value;
        }
      }

      const imgAttributes = [
        { attr: "alt", prop: "alt" },
        { attr: "data-prev", prop: "prev" },
        { attr: "data-next", prop: "next" },
        { attr: "data-fullsrc", prop: "src" },
        { attr: "data-modal-srcset", prop: "srcset" },
        { attr: "data-modal-sizes", prop: "sizes" },
        { attr: "data-modal-height", prop: "height"},
        { attr: "data-modal-width", prop: "width"},
      ];

      for (const { attr, prop } of imgAttributes) {
        const value = clickedEl.getAttribute(attr);
        const isPrevNext = attr === "data-prev" || attr === "data-next";
        if (value || isPrevNext) {
          this.modalImage[prop as keyof ModalImage] = value ?? "";
        }
      }
      if (!this.isModalOpen) {
        this.isModalOpen = true;
        this.modalOpener = clickedEl;
        this.lockScroll(true);
        this.$nextTick(() => (this.$refs.modal as HTMLElement | undefined)?.querySelector<HTMLElement>("button")?.focus());
      }
    },
    closeModal() {
      if (!this.isModalOpen) return;
      this.isModalOpen = false;
      this.lockScroll(false);
      const opener = this.modalOpener;
      this.modalOpener = null;
      if (opener?.isConnected) opener.focus();
    },
    handleKeyDown(event: KeyboardEvent) {
      if (!this.isModalOpen) return;
      if (event.key === "Escape") {
        this.closeModal();
      } else if (event.key === "ArrowLeft") {
        if (!this.isModalOpen || !this.modalImage.prev) {
          return;
        }
        const imageId = this.modalImage.prev.split("-")[1]
        const prevImage = document.getElementById("gallery-image-" + imageId) as HTMLImageElement;
        if (!prevImage) {
          return;
        }
        this.setModalFromImage(prevImage);
      } else if (event.key === "ArrowRight") {
        if (!this.isModalOpen || !this.modalImage.next) {
          return;
        }
        const imageId = this.modalImage.next.split("-")[1]
        const nextImage = document.getElementById("gallery-image-" + imageId) as HTMLImageElement;
        if (!nextImage) {
          return;
        }
        this.setModalFromImage(nextImage);
      }

    },
    handleModalClick(e: Event) {
      if (!e.target) {
        return;
      }
      const clickedEl = e.target as HTMLElement;
      // console.log("handleModalClick: ", clickedEl.id);
      if (clickedEl.id === "modal-div") {
        this.closeModal();
      } else if (clickedEl.id === "modal-image") {
        window.open(this.modalImage.src, '_blank');
      }
    },
    stripAudioBlocks(html: string): string {
      if (!html) {
        return "";
      }
      const doc = new DOMParser().parseFromString(html, "text/html");
      doc.querySelectorAll(".block-audio, podlove-player, cast-audio-player, cast-transcript, cast-chapters, .cast-player__panels").forEach((node) => node.remove());
      return doc.body.innerHTML;
    },
  },
  computed: {
    useRouterLink(): boolean {
      return config.pageType !== "styleguide";
    },
    postLink(): string {
      if (this.post?.meta?.html_url) {
        return this.post.meta.html_url;
      }
      if (this.post?.meta?.detail_url) {
        return this.post.meta.detail_url;
      }
      return "#";
    },
    articleData(): ArticleData {
      const dom = new DOMParser().parseFromString(this.post.html_detail, "text/html");
      const {
        articleDate = "",
        articleDateTime = "",
        articleAuthor = "",
      } = dom.getElementById("vue-article-data")?.dataset ?? {};
      return {
        articleDate,
        articleDateTime,
        articleAuthor,
      }
    },
    commentMeta(): CommentMeta {
      const postCommentUrl = config.postCommentUrl;
      const csrfToken = config.csrfToken;
      const commentMeta: CommentMeta = {
        ...this.post.comments_security_data,
        postCommentUrl,
        csrfToken,
        commentsAreEnabled: this.post.comments_are_enabled,
      }
      return commentMeta;
    },
    podlovePlayers(): [string, string][] {
      return Array.isArray(this.post.podlove_players) ? this.post.podlove_players : [];
    },
    coverUrl(): string {
      return resolveHttpUrl(this.post.cover_image_poster_url, window.location.href);
    },
    // The server formats the date in the site's language and time zone.
    dateLabel(): string {
      if (this.articleData.articleDate) return this.articleData.articleDate;
      const date = new Date(this.post.visible_date);
      if (Number.isNaN(date.getTime())) return "";
      return new Intl.DateTimeFormat(document.documentElement.lang || undefined, { dateStyle: "medium" }).format(date);
    },
    moreLabel(): string {
      return this.podlovePlayers.length > 0 ? "Show notes" : "Read more";
    },
    apiPodlovePlayerConfigUrl() {
      return config.apiPodlovePlayerConfigUrl;
    },
    detailHtml(): string {
      return this.stripAudioBlocks(this.post.html_detail);
    },
    overviewHtml(): string {
      return this.stripAudioBlocks(this.post.html_overview);
    },
    showPodlovePlayers(): boolean {
      if (config.pageType !== "styleguide") {
        return true;
      }
      return this.detail;
    },
  },
};
</script>
