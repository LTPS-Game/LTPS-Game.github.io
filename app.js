(() => {
  "use strict";

  const project = window.PROJECT;
  document.querySelectorAll("[data-content]").forEach((element) => {
    element.textContent = project[element.dataset.content];
    element.hidden = !project[element.dataset.content];
  });
  document.title = project.title;
  document.querySelector('meta[name="description"]').content = project.abstract;
  const methodImage = document.querySelector("#method-image");
  methodImage.src = project.methodImage;
  methodImage.alt = project.methodImageAlt;

  const links = document.querySelector("#project-links");
  if (project.paperUrl) links.replaceChildren();
  for (const [label, url] of [["Paper", project.paperUrl], ["Code", project.codeUrl]]) {
    if (!url) continue;
    const link = document.createElement("a");
    link.className = "project-link";
    link.textContent = label;
    link.href = url;
    links.append(link);
  }
  if (project.contactEmail) {
    const link = document.createElement("a");
    link.textContent = project.contactEmail;
    link.href = `mailto:${project.contactEmail}`;
    document.querySelector("#contact").replaceChildren(link);
  }

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let allPaused = reducedMotion.matches;
  let activeModel = "4B";
  const manuallyPaused = new Set();
  const cards = new Map();
  const visibleVideos = new Set();
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  const toggleAll = document.querySelector("#toggle-playback");
  const playIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15L19 12z"/></svg>';
  const pauseIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h4v16H6zm8 0h4v16h-4z"/></svg>';

  function updateGlobalControl() {
    toggleAll.textContent = allPaused ? "Play all" : "Pause all";
  }

  function updateClipControl(card) {
    const action = card.video.paused ? "Play" : "Pause";
    card.button.innerHTML = card.video.paused ? playIcon : pauseIcon;
    card.button.setAttribute("aria-label", `${action} ${card.clip.title} (${card.clip.model}, ${card.clip.duration} seconds)`);
    card.button.title = `${action} · ${card.clip.duration}s`;
  }

  function syncVideo(card) {
    const { video, clip } = card;
    const visible = visibleVideos.has(video);
    if (visible && !video.getAttribute("src")) {
      video.src = clip.video;
      video.load();
    }
    if (visible && !document.hidden && !allPaused && !manuallyPaused.has(clip.id)) {
      video.play().catch(() => updateClipControl(card));
    } else {
      video.pause();
    }
  }

  const observer = "IntersectionObserver" in window ? new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) visibleVideos.add(entry.target);
      else visibleVideos.delete(entry.target);
      const card = cards.get(entry.target.dataset.clipId);
      if (card) syncVideo(card);
    }
  }, { threshold: 0.15 }) : null;

  function createCard(clip) {
    const figure = document.createElement("figure");
    figure.className = "video-card";
    const stage = document.createElement("div");
    stage.className = "video-stage";
    const video = document.createElement("video");
    video.dataset.clipId = clip.id;
    video.muted = true;
    video.defaultMuted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = "none";
    video.poster = clip.poster;
    video.setAttribute("aria-label", `${clip.title} — ${clip.model} gameplay highlight`);
    stage.append(video);

    const caption = document.createElement("figcaption");
    caption.className = "video-caption";
    const title = document.createElement("span");
    title.className = "game-title";
    title.textContent = clip.title;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "clip-toggle";
    caption.append(title, button);
    figure.append(stage, caption);
    const card = { clip, video, button };
    cards.set(clip.id, card);
    updateClipControl(card);

    video.addEventListener("play", () => updateClipControl(card));
    video.addEventListener("pause", () => updateClipControl(card));
    video.addEventListener("error", () => {
      if (!video.getAttribute("src")) return;
      button.disabled = true;
      if (stage.querySelector(".video-error")) return;
      const message = document.createElement("p");
      message.className = "video-error";
      message.textContent = "Video unavailable";
      stage.append(message);
    });
    button.addEventListener("click", () => {
      if (video.paused) {
        if (allPaused) {
          cards.forEach((other) => manuallyPaused.add(other.clip.id));
          allPaused = false;
          updateGlobalControl();
        }
        manuallyPaused.delete(clip.id);
      } else manuallyPaused.add(clip.id);
      syncVideo(card);
    });
    if (observer) observer.observe(video);
    else visibleVideos.add(video);
    return figure;
  }

  function renderModel(model) {
    activeModel = model;
    observer?.disconnect();
    cards.forEach(({ video }) => {
      video.pause();
      video.removeAttribute("src");
      video.load();
    });
    cards.clear();
    visibleVideos.clear();
    for (const tab of tabs) {
      const selected = tab.dataset.model === model;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected) document.querySelector("#gameplay-panel").setAttribute("aria-labelledby", tab.id);
    }
    const selected = window.HIGHLIGHTS.filter((clip) => clip.model === model);
    document.querySelector("#seen-grid").replaceChildren(...selected.filter((clip) => clip.group === "seen").map(createCard));
    document.querySelector("#unseen-grid").replaceChildren(...selected.filter((clip) => clip.group === "unseen").map(createCard));
    if (!observer) cards.forEach(syncVideo);
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => {
      if (activeModel !== tab.dataset.model) renderModel(tab.dataset.model);
    });
    tab.addEventListener("keydown", (event) => {
      let target;
      if (event.key === "ArrowRight") target = tabs[(index + 1) % tabs.length];
      if (event.key === "ArrowLeft") target = tabs[(index - 1 + tabs.length) % tabs.length];
      if (event.key === "Home") target = tabs[0];
      if (event.key === "End") target = tabs[tabs.length - 1];
      if (!target) return;
      event.preventDefault();
      target.focus();
      target.click();
    });
  });
  toggleAll.addEventListener("click", () => {
    allPaused = !allPaused;
    if (!allPaused) manuallyPaused.clear();
    updateGlobalControl();
    cards.forEach(syncVideo);
  });
  document.addEventListener("visibilitychange", () => cards.forEach(syncVideo));
  reducedMotion.addEventListener("change", (event) => {
    if (event.matches) {
      allPaused = true;
      updateGlobalControl();
      cards.forEach(syncVideo);
    }
  });
  updateGlobalControl();
  renderModel(activeModel);
})();
