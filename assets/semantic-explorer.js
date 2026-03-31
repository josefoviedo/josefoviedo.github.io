(function () {
  const chipGrid = document.getElementById("semantic-chip-grid");
  const output = document.getElementById("semantic-output");
  const resetButton = document.getElementById("semantic-reset");
  const shuffleButton = document.getElementById("semantic-shuffle");

  if (!chipGrid || !output || !resetButton || !shuffleButton) {
    return;
  }

  const DATA_URL = "assets/semantic_items.json";
  const VISIBLE_CARD_COUNT = 8;
  const STOP_WORDS = new Set([
    "a", "an", "and", "are", "around", "as", "at", "be", "been", "being",
    "build", "built", "by", "can", "clean", "current", "data", "for", "from",
    "help", "how", "in", "into", "is", "it", "its", "more", "of", "on", "or",
    "over", "right", "site", "systems", "that", "the", "their", "them", "this",
    "through", "to", "tools", "use", "used", "using", "with", "work", "workflows"
  ]);
  const TAG_LABELS = {
    ai: "AI",
    cli: "CLI",
    etl: "ETL",
    faiss: "FAISS",
    hpc: "HPC",
    ml: "ML",
    qc: "QC",
    rag: "RAG",
    slurm: "SLURM",
    ui: "UI"
  };

  const state = {
    allCards: [],
    cards: [],
    visibleCards: [],
    projects: [],
    activeCardId: null
  };

  function tokenize(value) {
    const normalized = (value || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .replace(/-/g, " ");

    return Array.from(
      new Set(
        normalized
          .split(/\s+/)
          .filter((token) => token && token.length > 2 && !STOP_WORDS.has(token))
      )
    );
  }

  function intersect(a, b) {
    const right = new Set(b);
    return a.filter((item) => right.has(item));
  }

  function formatTag(tag) {
    if (TAG_LABELS[tag]) {
      return TAG_LABELS[tag];
    }

    return tag
      .split("-")
      .map((part) => TAG_LABELS[part] || (part.charAt(0).toUpperCase() + part.slice(1)))
      .join(" ");
  }

  function clearChildren(node) {
    while (node.firstChild) {
      node.removeChild(node.firstChild);
    }
  }

  function sampleCards(cards, count) {
    const copy = cards.slice();

    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      const temp = copy[index];
      copy[index] = copy[swapIndex];
      copy[swapIndex] = temp;
    }

    return copy.slice(0, Math.min(count, copy.length));
  }

  function makeTagList(tags) {
    const list = document.createElement("ul");
    list.className = "semantic-mini-tags";

    tags.forEach((tag) => {
      const item = document.createElement("li");
      item.textContent = formatTag(tag);
      list.appendChild(item);
    });

    return list;
  }

  function setActiveChip() {
    chipGrid.querySelectorAll(".semantic-chip").forEach((button) => {
      const isActive = button.dataset.cardId === state.activeCardId;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });
  }

  function computeProjectMatch(card, project) {
    const directMatch = (card.related_projects || []).includes(project.id);
    const sharedTags = intersect(card.tags || [], project.tags || []);
    const cardTokens = tokenize([card.title, card.summary, card.semantic_text].join(" "));
    const projectTokens = tokenize([
      project.title,
      project.summary,
      project.semantic_text,
      ...(project.capabilities || [])
    ].join(" "));
    const sharedTokens = intersect(cardTokens, projectTokens).slice(0, 4);

    let score = 0;
    if (directMatch) {
      score += 6;
    }
    score += sharedTags.length * 2;
    score += Math.min(sharedTokens.length, 4);

    return {
      project,
      score,
      directMatch,
      sharedTags,
      sharedTokens
    };
  }

  function buildReason(match) {
    const parts = [];

    if (match.directMatch) {
      parts.push("Directly tied to this focus area.");
    }

    if (match.sharedTags.length) {
      parts.push(
        "Shared signals: " + match.sharedTags.slice(0, 3).map(formatTag).join(", ") + "."
      );
    }

    if (match.sharedTokens.length) {
      parts.push(
        "Also overlaps on " + match.sharedTokens.slice(0, 3).join(", ") + "."
      );
    }

    return parts.join(" ");
  }

  function renderOverview() {
    clearChildren(output);

    const wrapper = document.createElement("div");
    wrapper.className = "semantic-focus";

    const title = document.createElement("h3");
    title.textContent = "Start with a concept card";
    wrapper.appendChild(title);

    const intro = document.createElement("p");
    intro.textContent =
      "This explorer rotates " + state.visibleCards.length + " cards at a time from a featured set of " + state.cards.length + ", then maps them against the 3 featured project pages on the site. Some cards point directly to published current work, while others reflect directions I am actively building toward.";
    wrapper.appendChild(intro);

    wrapper.appendChild(
      makeTagList([
        "hpc",
        "retrieval",
        "methylation",
        "research-computing",
        "on-device-ai",
        "agentic-systems"
      ])
    );

    const note = document.createElement("div");
    note.className = "semantic-note";
    note.textContent =
      "Try starting with HPC Workflow Engineering, Reproducible Modeling, Retrieval for Research, or Agentic Prototyping.";
    wrapper.appendChild(note);

    output.appendChild(wrapper);
  }

  function renderResultCard(match) {
    const card = document.createElement("a");
    card.className = "semantic-result-card";
    card.href = match.project.href;

    const kicker = document.createElement("p");
    kicker.className = "semantic-result-kicker";
    kicker.textContent = match.directMatch ? "Strong match" : "Closest current work";
    card.appendChild(kicker);

    const title = document.createElement("h4");
    title.textContent = match.project.title;
    card.appendChild(title);

    const summary = document.createElement("p");
    summary.textContent = match.project.summary;
    card.appendChild(summary);

    const reason = document.createElement("p");
    reason.textContent = buildReason(match);
    card.appendChild(reason);

    return card;
  }

  function renderCard(cardId) {
    const selected = state.allCards.find((card) => card.id === cardId);
    if (!selected) {
      return;
    }

    state.activeCardId = cardId;
    resetButton.disabled = false;
    setActiveChip();
    clearChildren(output);

    const focus = document.createElement("div");
    focus.className = "semantic-focus";

    const title = document.createElement("h3");
    title.textContent = selected.title;
    focus.appendChild(title);

    const summary = document.createElement("p");
    summary.textContent = selected.summary;
    focus.appendChild(summary);

    const why = document.createElement("p");
    why.textContent = selected.why_it_matters;
    focus.appendChild(why);

    focus.appendChild(makeTagList((selected.tags || []).slice(0, 6)));
    output.appendChild(focus);

    const scored = state.projects
      .map((project) => computeProjectMatch(selected, project))
      .sort((left, right) => right.score - left.score);

    const strongMatches = scored.filter((match) => match.score >= 3);

    const resultsBlock = document.createElement("div");
    resultsBlock.className = "semantic-results-block";

    const heading = document.createElement("h4");
    heading.className = "semantic-results-heading";
    heading.textContent = "Closest current work";
    resultsBlock.appendChild(heading);

    if (strongMatches.length) {
      const list = document.createElement("div");
      list.className = "semantic-results-list";

      strongMatches.slice(0, 3).forEach((match) => {
        list.appendChild(renderResultCard(match));
      });

      resultsBlock.appendChild(list);
    } else {
      const note = document.createElement("div");
      note.className = "semantic-note";
      note.textContent =
        "This card is more about current direction than a finished flagship project on the site. It is still worth keeping because it signals where I am actively pushing next.";
      resultsBlock.appendChild(note);

      const adjacent = scored[0];
      if (adjacent && adjacent.score > 0) {
        const list = document.createElement("div");
        list.className = "semantic-results-list";
        list.appendChild(renderResultCard(adjacent));
        resultsBlock.appendChild(list);
      }
    }

    output.appendChild(resultsBlock);
  }

  function renderChips() {
    clearChildren(chipGrid);

    state.visibleCards.forEach((card) => {
      const button = document.createElement("button");
      button.className = "semantic-chip";
      button.type = "button";
      button.dataset.cardId = card.id;
      button.textContent = card.title;
      button.setAttribute("aria-pressed", "false");
      button.addEventListener("click", () => renderCard(card.id));
      chipGrid.appendChild(button);
    });
  }

  function shuffleVisibleCards() {
    state.activeCardId = null;
    resetButton.disabled = true;
    state.visibleCards = sampleCards(state.cards, VISIBLE_CARD_COUNT);
    renderChips();
    setActiveChip();
    renderOverview();
  }

  resetButton.addEventListener("click", () => {
    state.activeCardId = null;
    resetButton.disabled = true;
    setActiveChip();
    renderOverview();
  });

  shuffleButton.addEventListener("click", () => {
    shuffleVisibleCards();
  });

  fetch(DATA_URL)
    .then((response) => {
      if (!response.ok) {
        throw new Error("Could not load semantic explorer data.");
      }
      return response.json();
    })
    .then((data) => {
      const allCards = data.concept_cards || [];
      const featuredIds = data.featured_card_ids || [];

      state.allCards = allCards;
      state.cards = featuredIds.length
        ? featuredIds
            .map((id) => allCards.find((card) => card.id === id))
            .filter(Boolean)
        : allCards;
      state.projects = data.project_items || [];
      shuffleVisibleCards();
    })
    .catch(() => {
      output.innerHTML =
        '<p class="semantic-state">Could not load the semantic explorer right now.</p>';
    });
}());
