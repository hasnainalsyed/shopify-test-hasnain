document.addEventListener("DOMContentLoaded", function () {
  const mainImage = document.querySelector("[data-product-gallery-main-image]");
  const thumbs = document.querySelectorAll("[data-product-gallery-thumb]");

  thumbs.forEach(thumb => {
    thumb.addEventListener("click", function () {
      // Update main image
      mainImage.style.opacity = "0";
      setTimeout(() => {
        mainImage.src = this.dataset.full;
        mainImage.alt = this.alt;
        mainImage.style.opacity = "1";
      }, 200);

      // Update active state
      thumbs.forEach(t => t.classList.remove("main-product__product-gallery-thumb--active"));
      this.classList.add("main-product__product-gallery-thumb--active");
    });
  });
});