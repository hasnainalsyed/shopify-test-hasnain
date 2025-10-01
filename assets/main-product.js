class MainProduct {
  constructor(container) {
    this.container = container;
    this.sectionId = container.dataset.section;
    this.url = container.dataset.url || window.location.pathname;
    this.productId = container.dataset.productId;

    // Parse metafields JSON
    const mfEl = document.getElementById(`ProductMetafields-${this.sectionId}`);
    try {
      this.metafields = mfEl ? JSON.parse(mfEl.textContent) : {};
    } catch (e) {
      this.metafields = {};
    }

    this._delegationAttached = false;
    this.setup();

    // Ensure ?variant=id on first load
    const currentVariantId = this.variantInput?.value;
    if (currentVariantId) {
      const url = new URL(window.location.href);
      if (!url.searchParams.has("variant")) {
        url.searchParams.set("variant", currentVariantId);
        window.history.replaceState({}, "", url.toString());
      }
    }

    // Handle browser back/forward
    window.addEventListener("popstate", () => {
      const v = new URL(window.location.href).searchParams.get("variant");
      if (v) this.renderVariant(v, false);
    });
  }

  /** Grab refs and attach delegated click handler */
  setup() {
    this.form = this.container.querySelector("form");
    this.variantInput = this.form?.querySelector("[name='id']");
    this.priceContainer = this.container.querySelector("[data-product-price]");
    this.addToCartBtn = this.container.querySelector("[data-buy-button-submit]");

    // listen to manual input change
    const qtyInput = this.container.querySelector("[data-quantity-selector-input]");
    if (qtyInput && this.form) {
      qtyInput.addEventListener("input", () => {
        const hiddenQty = this.form.querySelector('input[name="quantity"]');
        if (hiddenQty) hiddenQty.value = qtyInput.value;
      });
    }

    if (!this._delegationAttached) {
      this.container.addEventListener("click", this._onContainerClick.bind(this));
      this._delegationAttached = true;
    }
  }

  /** Delegated click handler */
  _onContainerClick(e) {
    const thumb = e.target.closest("[data-product-gallery-thumb]");
    if (thumb) {
      e.preventDefault();
      this._onThumbClick(thumb);
      return;
    }

    const swatch = e.target.closest("[data-variant-id]");
    if (swatch) {
      e.preventDefault();
      this.changeVariant(swatch.dataset.variantId);
      return;
    }

    const qtyBtn = e.target.closest("[data-quantity-selector-button]");
    if (qtyBtn) {
      e.preventDefault();
      this._onQuantityButton(qtyBtn);
    }
  }

  /** Thumbnail click logic */
  _onThumbClick(thumb) {
    const mainImage = this.container.querySelector("[data-product-gallery-main-image]");
    if (!mainImage) return;

    if (!mainImage.style.transition) {
      mainImage.style.transition = "opacity 180ms ease";
    }

    const newSrc = thumb.dataset.full || thumb.src;
    mainImage.style.opacity = "0";
    setTimeout(() => {
      mainImage.src = newSrc;
      mainImage.alt = thumb.alt || "";
      mainImage.style.opacity = "1";
    }, 140);

    this.container.querySelectorAll("[data-product-gallery-thumb]").forEach((t) =>
      t.classList.remove("main-product__product-gallery-thumb--active")
    );
    thumb.classList.add("main-product__product-gallery-thumb--active");
  }

  /** Quantity +/- */
  _onQuantityButton(btn) {
    const wrapper = btn.closest("[data-quantity-selector-wrapper]");
    if (!wrapper) return;
    const input = wrapper.querySelector("[data-quantity-selector-input]");
    if (!input) return;

    let value = parseInt(input.value, 10) || 1;
    if (btn.dataset.quantitySelectorButton === "minus") {
      value = Math.max(1, value - 1);
    } else {
      value = value + 1;
    }
    input.value = value;
    input.dispatchEvent(new Event("change", { bubbles: true }));

    // 🔑 also sync hidden form quantity input
    const hiddenQty = this.form?.querySelector('input[name="quantity"]');
    if (hiddenQty) hiddenQty.value = value;
  }

  /** User changed variant */
  async changeVariant(variantId) {
    if (!variantId) return;
    if (this.variantInput) this.variantInput.value = variantId;

    const url = new URL(window.location.href);
    url.searchParams.set("variant", variantId);
    window.history.pushState({}, "", url.toString());

    await this.renderVariant(variantId, true);
  }

  /** Replace section HTML */
  async renderVariant(variantId, scrollToTop = false) {
    const fetchUrl = `${this.url}?variant=${variantId}&section_id=${this.sectionId}`;
    try {
      const res = await fetch(fetchUrl);
      const text = await res.text();
      const doc = new DOMParser().parseFromString(text, "text/html");

      // Replace gallery
      const newGallery = doc.querySelector(
        `[data-section="${this.sectionId}"] .main-product__product-gallery`
      );
      const oldGallery = this.container.querySelector(".main-product__product-gallery");
      if (newGallery && oldGallery) oldGallery.replaceWith(newGallery);

      // Replace product info
      const newInfo = doc.querySelector(
        `[data-section="${this.sectionId}"] .main-product__product-info`
      );
      const oldInfo = this.container.querySelector(".main-product__product-info");
      if (newInfo && oldInfo) oldInfo.replaceWith(newInfo);

      // Refresh refs after replacement
      this.setup();

      // Update swatch states + hidden input
      this._updateSwatchState(variantId);
      if (this.variantInput) this.variantInput.value = variantId;

      // Swap metafield images if present
      this.loadVariantMetafieldImages(variantId);

      if (scrollToTop) window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      console.error("Variant render failed", err);
    }
  }

  /** Update active swatch */
  _updateSwatchState(variantId) {
    this.container.querySelectorAll("[data-variant-id]").forEach((s) => {
      s.classList.toggle(
        "main-product__variant-picker-swatch--active",
        s.dataset.variantId === String(variantId)
      );
    });
  }

  /** Load metafield images */
  loadVariantMetafieldImages(variantId) {
    const variantMeta = this.metafields?.variants?.[variantId];
    if (!variantMeta || !variantMeta.variant_images?.length) return;

    const images = (Array.isArray(variantMeta.variant_images)
      ? variantMeta.variant_images
      : [variantMeta.variant_images]
    ).map((img) => (typeof img === "string" ? img : img.url));

    const mainImage = this.container.querySelector("[data-product-gallery-main-image]");
    const thumbsWrapper = this.container.querySelector("[data-product-gallery-thumbs]");

    if (mainImage && images.length) mainImage.src = images[0];

    if (thumbsWrapper) {
      thumbsWrapper.innerHTML = images
        .map(
          (img, i) => `<img
            class="main-product__product-gallery-thumb${i === 0 ? " main-product__product-gallery-thumb--active" : ""}"
            src="${img}"
            data-full="${img}"
            alt="Variant image ${i + 1}"
            loading="lazy"
            data-product-gallery-thumb="true"
          >`
        )
        .join("");
    }
  }
}

/* Init */
document.addEventListener("DOMContentLoaded", () => {
  const mainProductEl = document.querySelector("[data-product-info-main]");
  if (mainProductEl) new MainProduct(mainProductEl);
});