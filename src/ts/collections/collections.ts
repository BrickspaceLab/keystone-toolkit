export const collections = {
  // Call section render API with data from filter
  async fetchAndRenderCollection(filterData: FormData) {
    // Loop through form data and build url
    const filterUrl = this.buildUrlFilter(filterData);

    // Get search term
    let searchUrl = new URL(location.href).searchParams.get("q");
    searchUrl = searchUrl ? `&q=${searchUrl}` : "";

    // Update page url
    history.pushState(
      null,
      "",
      `${window.location.pathname}?${filterUrl}${searchUrl}`,
    );

    // Listen to popstate event
    window.addEventListener("popstate", () => {
      this.fetchAndRenderCollection(filterData);
    });

    // Get data from Shopify
    try {
      const response = await fetch(
        `${window.location.pathname}?section_id=${this.pagination_section}${filterUrl}${searchUrl}`,
      );

      // If response is not OK, throw an error
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Parse response data
      const data = await response.text();

      // Replace section with new content
      const sectionElement = document.getElementById(
        `shopify-section-${this.pagination_section}`,
      );
      if (sectionElement) {
        sectionElement.innerHTML = data;
      }

      // Scroll to top
      this.scrollToTopOfPagination();

      // Reset loading
      this.loadImages();
      this.pagination_loading = false;
    } catch (error) {
      console.error("Error:", error);
      this.pagination_loading = false;
    }
  },

  // Check if next page is avaible and inject more products
  async fetchAndRenderTableRows(product_handle: string, total_pages: number, current_page: number, section_id: string, inject_before: string) {
    
    // Show loading
    this.pagination_loading = true;

    // Get pagination count
    const pageUrl = `&page=${current_page}`;

    // Build fetch url
    let fetchUrl = `${window.Shopify.routes.root}products/${product_handle}?section_id=${section_id}${pageUrl}`;

    // Check if new page is available
    if (current_page <= total_pages) {
      // Get data from Shopify
      try {
        const response = await fetch(fetchUrl);
        const data = await response.text();

        // Create a new HTML element and set its innerHTML to the fetched data
        const tempElement = document.createElement("div");
        tempElement.innerHTML = data;

        // Find the results within the fetched data
        const fetchedElement = tempElement.querySelector(".js-results");

        // If results are found, append its innerHTML to the existing element on the page
        if (fetchedElement) {
          const injectSpot = document.querySelector(inject_before);
          if (injectSpot) {
            injectSpot.insertAdjacentHTML(
              "beforeend",
              fetchedElement.innerHTML,
            );
          }
        }

        if (current_page >= total_pages) {
          this.pagination_load_more_button = false;
        }

        // Reset loading
        this.loadImages();

        // Reset loading
        this.pagination_loading = false;
      } catch (error) {
        console.error("Error:", error);
        this.pagination_loading = false;
      }
    }

    // If last page, stop loading
    else {
      this.pagination_loading = false;
    }
  },
  
  // Check if next page is avaible and inject more products
  async fetchAndRenderPage (direction: "next" | "previous") {
  // Prevent browser from scrolling down
  history.scrollRestoration = "manual";

  // Show loading
  this.pagination_loading = true;

  // Update URL to show updated page number
  if (direction === "next") {
    let url = new URL(window.location.href);
    url.searchParams.set("page", this.pagination_current_page + 1);
    window.history.pushState({}, "", url.toString());
  }

  // Get filter data
  const filter = document.getElementById("js-desktopFilter") as HTMLFormElement;

  // Get pagination count
  const pageUrl = `&page=${direction === "next" ? this.pagination_current_page + 1 : this.pagination_current_page - 1}`;

  // Get search parameter
  const searchUrl = new URL(location.href).searchParams.get("q") ? `&q=${new URL(location.href).searchParams.get("q")}` : '';

  // Build fetch url
  let fetchUrl = `${window.location.pathname}?section_id=${this.pagination_section}${pageUrl}${searchUrl}`;

  // If filter exists, add filter data to fetch url
  if (filter) {
    const filterData = new FormData(filter);
    const filterUrl = this.buildUrlFilter(filterData);
    fetchUrl += filterUrl;
  }
  
  // Check if new page is available
  if (this.pagination_current_page < this.pagination_total_pages ||
    direction === "previous") {

    // Get data from Shopify
    try {
      const response = await fetch(fetchUrl);
      const data = await response.text();

      // Create a new HTML element and set its innerHTML to the fetched data
      const tempElement = document.createElement("div");
      tempElement.innerHTML = data;

      // Find the results within the fetched data
      const fetchedElement = tempElement.querySelector("#js-results");

      // If results are found, append its innerHTML to the existing element on the page
      if (fetchedElement) {
        const resultsElement = document.getElementById("js-results");
        if (resultsElement) {
          if (direction === "next") {
            resultsElement.insertAdjacentHTML(
              "beforeend",
              fetchedElement.innerHTML,
            );
          } else {
            resultsElement.insertAdjacentHTML(
              "afterbegin",
              fetchedElement.innerHTML,
            );
          }
        }
      }

      // Update next page url
       // Update next page url
       if (direction === "next") {
        this.pagination_current_page += 1;
        this.pagination_pages_loaded += 1;
      } else {
        this.pagination_current_page -= 1;
      }
      
      // Reset loading
      // this.loadImages();
      this.pagination_loading = false;
    } 

    catch (error) {
      console.error("Error:", error);
      this.pagination_loading = false;
    }
  } 
  
  // If last page, stop loading
  else {
    this.pagination_loading = false;
  }
  },

  // Load quick add with section render
  async fetchAndRenderQuickGallery(product_handle: string) {
    // Get data from Shopify
    try {
      const response = await fetch(
        `${window.Shopify.routes.root}products/${product_handle}?section_id=quick-gallery`,
      );

      // If response is not OK, throw an error
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      // catpure data from fetch
      const responseHtml = await response.text();

      // disable body scrolling when quick add is visible
      this.enable_body_scrolling = false;

      // Get quick add container and inject new
      const quickGalleryContainer = document.getElementById(`js-quickGallery`);
      if (quickGalleryContainer) {
        quickGalleryContainer.innerHTML = responseHtml;
        this.loadImages();
      } else {
        console.error(
          `Element 'js-quickGallery-${template}-${product_handle}' not found.`,
        );
      }
    } catch (error) {
      console.error(error);
    }
  },

  // Handle filter change
  handleFilterChange(id: string): void {
    // Show loading indication
    this.pagination_loading = true;

    // Reset pagination
    this.pagination_current_page = 1;

    // Close mobile filter
    this.filter_overlay = false;

    // Get filter element
    const filter = document.getElementById(id) as HTMLFormElement | null;

    // Check if filter exists before proceeding
    if (!filter) {
      console.error(`Filter element with id ${id} not found.`);
      return;
    }

    // Capture filter data
    const filterData = new FormData(filter);

    // Get and inject new collection results
    this.fetchAndRenderCollection(filterData);
  },

  // Handle deleting filters
  handleFilterDelete(filterToReset: string): void {
    // Show loading indication
    this.pagination_loading = true;

    // Get filter element
    const filter = document.getElementById(
      "js-desktopFilter",
    ) as HTMLFormElement | null;

    if (filter) {
      // Capture filter data
      const filterData = new FormData(filter);

      // Remove deleted filter
      filterData.delete(filterToReset);

      // Reset the price filters to their initial values
      if (filterToReset.includes("price")) {
        filterData.delete("filter.v.price.gte");
        filterData.delete("filter.v.price.lte");
        this.filter_min_price = this.filter_min;
        this.filter_max_price = this.filter_max;
      }

      // Get and inject new collection results
      this.fetchAndRenderCollection(filterData);
    } else {
      console.error("Filter element 'js-desktopFilter' not found.");
    }
  },

  // Handle deleting all filters
  handleFilterDeleteAll() {
    // Show loading indication
    this.pagination_loading = true;

    // Reset filterData
    const filterData = new FormData();

    // Get and inject new collection results
    this.fetchAndRenderCollection(filterData);
  },

  // Build urlFilter
  buildUrlFilter(filterData: FormData) {
    // Reset filter URL
    let urlFilter = "";

    // Loop through filterData form
    for (let pair of filterData.entries()) {
      const [key, value] = pair;

      // If filtering with price range
      if (key.includes("price")) {
        if (key === "filter.v.price.lte" && value < this.filter_max) {
          urlFilter += `&${key}=${value}`;
        }
        if (key === "filter.v.price.gte" && value > this.filter_min) {
          urlFilter += `&${key}=${value}`;
        }
      }

      // All other filters
      else {
        urlFilter += `&${key}=${encodeURIComponent(value)}`;
      }
    }

    // Return url
    return urlFilter;
  },

  // Method to scroll to the top of pagination
  scrollToTopOfPagination() {
    const element = document.querySelector(".js-paginationTop");
    if (element) {
      var headerOffset = 80;
      var elementPosition = element.getBoundingClientRect().top;
      var offsetPosition = elementPosition + window.scrollY - headerOffset;
      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
    }
  },

  handlePriceFilterChange(filterType: string) {
    const minSlider = document.querySelector(".min-val") as HTMLInputElement;
    const maxSlider = document.querySelector(".max-val") as HTMLInputElement;
    const priceInputMin = document.querySelector(
      ".min-input",
    ) as HTMLInputElement;
    const priceInputMax = document.querySelector(
      ".max-input",
    ) as HTMLInputElement;
    const minGap = 1; // Adjust this to control minimum spacing if needed

    let minValue = parseInt(minSlider.value);
    let maxValue = parseInt(maxSlider.value);

    if (filterType === "min") {
      if (minValue + minGap >= maxValue) {
        minValue = maxValue - minGap;
        minSlider.value = minValue.toString();
      }
      priceInputMin.value = minSlider.value;
      this.filter_min_price = minValue;
    } else if (filterType === "max") {
      if (maxValue - minGap <= minValue) {
        maxValue = minValue + minGap;
        maxSlider.value = maxValue.toString();
      }
      priceInputMax.value = maxSlider.value;
      this.filter_max_price = maxValue;
    } else {
      console.error('Invalid filter type. Expected "min" or "max".');
    }
  },

  setMinInput() {
    const minVal = document.querySelector(".min-val")! as HTMLInputElement;
    const sliderMinValue = parseInt(minVal.min);
    const priceInputMin = document.querySelector(
      ".min-input",
    )! as HTMLInputElement;

    let minPrice = parseInt(priceInputMin.value);
    if (minPrice < sliderMinValue) {
      priceInputMin.value = sliderMinValue.toString();
    }
    minVal.value = priceInputMin.value;
    this.handlePriceFilterChange("min");
  },

  setMaxInput() {
    const maxVal = document.querySelector(".max-val")! as HTMLInputElement;
    const sliderMaxValue = parseInt(maxVal.max);
    const priceInputMax = document.querySelector(
      ".max-input",
    )! as HTMLInputElement;

    let maxPrice = parseInt(priceInputMax.value);
    if (maxPrice > sliderMaxValue) {
      priceInputMax.value = sliderMaxValue.toString();
    }
    maxVal.value = priceInputMax.value;
    this.handlePriceFilterChange("max");
  },
};
