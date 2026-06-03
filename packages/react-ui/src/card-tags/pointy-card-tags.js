// pointy-card-tags.js

class PointyCardTags extends HTMLElement {
  static observedAttributes = ["aria-label"];

  #shadow;
  #mutationObserver;

  constructor() {
    super();

    this.#shadow = this.attachShadow({ mode: "open" });

    this.#shadow.innerHTML = `
      <style>
        :host {
          --tag-bg: #c8b7ff;
          --tag-bg-hover: #b7a1ff;
          --tag-border: #1d1d1d;
          --tag-text: #1d1d1d;

          --tag-rotation: -50deg;
          --tag-step: 3.5rem;
          --tags-right: 1.5rem;
          --tags-overlap: 1.1rem;

          --tip-size: 0.8rem;
          --border-size: 2px;
          --tag-height: 2.05rem;

          position: absolute;
          right: var(--tags-right);
          bottom: var(--tags-overlap);
          z-index: 2;
          display: block;
          overflow: visible;
        }

        .tags {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          overflow: visible;
        }

        .slot {
          position: relative;
          flex: 0 0 var(--tag-step);
          width: var(--tag-step);
          height: 0;
          overflow: visible;
        }

        .tag {
          position: absolute;
          right: 0;
          top: calc(var(--tag-height) / -2);

          display: inline-grid;
          place-items: center;
          height: var(--tag-height);

          padding-inline: 0 calc(0.75rem + var(--tip-size));
          padding-left: 0.75rem;

          color: var(--tag-text);
          font-size: 0.9rem;
          font-weight: 700;
          line-height: 1;
          text-decoration: none;
          white-space: nowrap;

          transform: rotate(var(--tag-rotation));
          transform-origin: 100% 50%;

          isolation: isolate;
          cursor: pointer;
        }

        .tag::before,
        .tag::after {
          content: "";
          position: absolute;
          inset: 0;
          clip-path: polygon(
            0 0,
            calc(100% - var(--tip-size)) 0,
            100% 50%,
            calc(100% - var(--tip-size)) 100%,
            0 100%
          );
        }

        .tag::before {
          z-index: -2;
          background: var(--tag-border);
        }

        .tag::after {
          z-index: -1;
          inset: var(--border-size);
          background: var(--tag-bg);
        }

        .tag:hover::after {
          background: var(--tag-bg-hover);
        }

        .tag:focus-visible {
          outline: 3px solid #245cff;
          outline-offset: 4px;
        }
      </style>

      <nav class="tags" part="tags"></nav>
    `;
  }

  connectedCallback() {
    this.#ensureParentCanAnchorTags();
    this.#render();

    this.#mutationObserver = new MutationObserver(() => this.#render());

    this.#mutationObserver.observe(this, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true
    });
  }

  disconnectedCallback() {
    this.#mutationObserver?.disconnect();
  }

  attributeChangedCallback() {
    this.#render();
  }

  #ensureParentCanAnchorTags() {
    const parent = this.parentElement;
    if (!parent) return;

    const parentStyle = getComputedStyle(parent);

    if (parentStyle.position === "static") {
      parent.style.position = "relative";
    }

    if (parentStyle.overflow !== "visible") {
      parent.style.overflow = "visible";
    }
  }

  #render() {
    const nav = this.#shadow.querySelector(".tags");
    const links = [...this.querySelectorAll("a")];

    nav.setAttribute(
      "aria-label",
      this.getAttribute("aria-label") || "Card tags"
    );

    nav.replaceChildren(
      ...links.map((sourceLink) => {
        const slot = document.createElement("span");
        slot.className = "slot";
        slot.part = "slot";

        const tag = document.createElement("a");
        tag.className = "tag";
        tag.part = "tag";

        tag.textContent = sourceLink.textContent.trim();

        for (const attr of sourceLink.attributes) {
          tag.setAttribute(attr.name, attr.value);
        }

        tag.addEventListener("click", (event) => {
          this.dispatchEvent(
            new CustomEvent("tag-click", {
              bubbles: true,
              composed: true,
              detail: {
                text: tag.textContent,
                href: tag.getAttribute("href"),
                originalEvent: event
              }
            })
          );
        });

        slot.append(tag);
        return slot;
      })
    );
  }
}

if (!customElements.get("pointy-card-tags")) {
  customElements.define("pointy-card-tags", PointyCardTags);
}