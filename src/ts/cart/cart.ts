import { Product } from "../models.interface";

// Interface for CartItem used in cart sharing
interface CartItem {
  variantId: number;
  quantity: number;
}

export const cart = {
  debounceTimeouts: new Map<HTMLInputElement, NodeJS.Timeout>(),
  
  // Add memoization for cart summary and grouped items
  _lastCartItemsHash: '',
  _memoizedSummary: null as any,
  _memoizedGroupedItems: null as any,

  // Generate a simple hash of cart items for memoization
  _generateCartHash(items: any[]): string {
    return items.map(item => `${item.variant_id}:${item.quantity}:${item.final_line_price}`).join('|');
  },

  // Update cart with fetched data
  async updateCart(openCart: boolean, openAlert: boolean = true) {
    // Reset global properties
    this.cart_loading = true;
    this.enable_body_scrolling = true;

    try {
      const response = await fetch(`${window.Shopify.routes.root}cart.js`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Shopify properties
      this.cart.items = data.items;
      this.cart.item_count = data.item_count;
      this.cart.total_price = data.total_price;
      this.cart.original_total_price = data.original_total_price;
      this.cart.total_discount = data.total_discount;
      this.cart.cart_level_discount_applications =
        data.cart_level_discount_applications;

      // Progress bar calculation
      let calcTotal;
      if (this.progress_bar_calculation === "total") {
        calcTotal = this.cart.total_price;
      } else {
        calcTotal = this.cart.original_total_price;
      }
      this.cart.progress_bar_delay_width = "0%";
      this.cart.progress_bar_remaining =
        this.progress_bar_threshold * (+window.Shopify.currency.rate || 1) -
        calcTotal;
      this.cart.progress_bar_percent =
        (calcTotal /
          (this.progress_bar_threshold *
            (+window.Shopify.currency.rate || 1))) *
          100 +
        "%";

      // Sort cart (with memoization)
      this.sortCartItems();

      // Reset cart loading
      setTimeout(() => {
        this.cart_loading = false;
      }, 200);

      // Optimize upsell handling - batch DOM operations
      this.handleUpsells();

      // Set cart behavior based on screen width
      let cart_behavior;
      if (window.innerWidth < 768) {
        cart_behavior = this.cart_behavior_mobile;
      } else {
        cart_behavior = this.cart_behavior_desktop;
      }

      // Show cart alert if cart_behavior is set to "alert"
      if (cart_behavior === "alert" && openAlert) {
        this.cart_alert = true;

        // Reset progress bar
        clearTimeout(this.cart_alert_timeout);
        this.cart.progress_bar_delay_width = "0%";

        // Set progress bar to 100% after a delay
        setTimeout(() => {
          this.cart.progress_bar_delay_width = "100%";
        }, 10);

        // Hide cart alert after 5 seconds
        this.cart_alert_timeout = setTimeout(() => {
          this.cart_alert = false;
        }, 4990);
      }

      // Open cart if set
      if (openCart) {
        // Hide other overlapping overlays
        this.age_overlay = false;
        this.audio_overlay = false;
        this.discount_alert = false;
        this.filter_overlay = false;
        this.localization_overlay = false;

        // Display different cart elements based on cart_behavior
        switch (cart_behavior) {
          case "drawer":
            if (this.cart_drawer_style === "fixed") {
              this.menu_drawer = false;
              this.menu_sidebar = false;
            }
            this.cart_drawer = true;
            break;
          case "redirect":
            window.location.href = "/cart";
            break;
        }
      }
    } catch (error: any) {
      console.error("Error:", error);
      this.cart_loading = false;
    }
  },

  // Optimized upsell handling - batch DOM operations
  handleUpsells() {
    // Get all cart item product IDs in a Set for O(1) lookup
    const cartProductIds = new Set(this.cart.items.map((item: any) => item.product_id));
    
    // Single DOM query for all upsells
    const allUpsells = document.querySelectorAll(".js-upsell");
    
    // Show all upsells first (batch operation)
    allUpsells.forEach((element) => {
      (element as HTMLElement).style.display = "flex";
    });

    // Hide upsells for items in cart (batch operation)
    cartProductIds.forEach(productId => {
      const upsellElements = document.querySelectorAll(`.js-upsell-${productId}`) as NodeListOf<HTMLElement>;
      upsellElements.forEach((element) => {
        element.style.display = "none";
      });
    });
  },

  // Update cart note
  async updateCartNote(note: string) {
    this.cart_loading = true;

    try {
      const response = await fetch(
        `${window.Shopify.routes.root}cart/update.js`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ note: note }),
        },
      );

      const data = await response.json();

      if (response.ok) {
        this.cart.items = data.items.map((item: Product) => ({ ...item }));
        this.updateCart(false);
      } else {
        throw new Error(data.description);
      }
    } catch (error: any) {
      this.error_message = error.message;
      this.error_alert = true;
    } finally {
      this.cart_loading = false;
    }
  },

  // Call change.js to update cart item then use updateCart()
  async changeCartItemQuantity(
    key: number,
    quantity: number,
    openCart: boolean,
    refresh: boolean,
  ) {
    // Play audio
    this.playAudioIfEnabled(this.click_audio);

    // Show loading state
    this.cart_loading = true;

    // Set data for fetch call
    let formData = {
      id: key.toString(),
      quantity: quantity.toString(),
    };

    // Get data from shopify
    try {
      const response = await fetch(
        `${window.Shopify.routes.root}cart/change.js`,
        {
          method: "POST",
          body: JSON.stringify(formData),
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      // Parse response data
      const data = await response.json();

      // Good response
      if (response.status === 200) {
        // Refresh and update cart
        if (refresh) {
          window.location.reload();
        } else {
          this.playAudioIfEnabled(this.success_audio);
          this.updateCart(openCart);
        }
      }

      // Error response
      else {
        this.error_message = data.description;
        this.error_alert = true;
        this.cart_loading = false;
      }
    } catch (error: any) {
      console.error("Error:", error);
      this.cart_loading = false;
    }
  },

  // Debounced version of changeCartItemQuantity
  // Will only execute once every 400ms
  changeCartItemQuantityDebounced(
    key: number,
    quantity: number,
    openCart: boolean,
    refresh: boolean,
    target: HTMLInputElement,
  ) {
    // Clear any existing timeout for the same target
    if (this.debounceTimeouts.has(target)) {
      clearTimeout(this.debounceTimeouts.get(target)!);
    }

    // Set a new timeout to call changeCartItemQuantity after 400ms
    const timeout = setTimeout(() => {
      this.changeCartItemQuantity(key, quantity, openCart, refresh);
      this.debounceTimeouts.delete(target);
    }, 400);

    // Store the timeout for the target
    this.debounceTimeouts.set(target, timeout);
  },

  // Call add.js to add cart item then use updateCart()
  async addCartItem(
    variantID: number,
    sellingPlanId: number,
    quantity: number,
    openCart: boolean,
    enableAudio: boolean = true,
  ) {
    this.cart_loading = true;
    this.enable_body_scrolling = true;
    if (enableAudio) {
      this.playAudioIfEnabled(this.click_audio);
    }
    let formData;

    // Update formData if sellingPlanId is available
    if (sellingPlanId == 0) {
      formData = {
        items: [
          {
            id: variantID,
            quantity: quantity,
          },
        ],
      };
    } else {
      formData = {
        items: [
          {
            id: variantID,
            quantity: quantity,
            selling_plan: sellingPlanId,
          },
        ],
      };
    }

    return fetch(`${window.Shopify.routes.root}cart/add.js`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(formData),
    })
      .then(async (response) => {
        let data = await response.json();

        // Good response
        if (response.status === 200) {
          this.playAudioIfEnabled(this.success_audio);
          this.updateCart(openCart);
        }

        // Error response
        else {
          this.error_message = data.description;
          this.error_alert = true;
          this.cart_loading = false;
        }
      })
      .catch((error) => {
        console.error("Error:", error);
        this.cart_loading = false;
      });
  },

  // Debounced version of addCartItem
  addCartItemDebounced(
    variantID: number,
    sellingPlanId: number,
    quantity: number,
    openCart: boolean,
    enableAudio: boolean = true,
    target: HTMLInputElement,
  ) {
    // Clear any existing timeout for the same target
    if (this.debounceTimeouts.has(target)) {
      clearTimeout(this.debounceTimeouts.get(target)!);
    }

    // Set a new timeout to call addCartItem after 400ms 
    const timeout = setTimeout(() => {
      this.addCartItem(
        variantID,
        sellingPlanId,
        quantity,
        openCart,
        enableAudio,
      );
      this.debounceTimeouts.delete(target);
    }, 400);

    // Store the timeout for the target
    this.debounceTimeouts.set(target, timeout);
  },

  // Add multiple items to cart, used for cart sharing
  async addCartItems(items: CartItem[]) {
    this.cart_loading = true;
    this.playAudioIfEnabled(this.click_audio);

    // Loop through each item and add it to the cart
    for (const item of items) {
      await this.addCartItem(item.variantId, 0, item.quantity, false, false);
    }

    this.cart_loading = false;
    this.updateCart(true);
    this.playAudioIfEnabled(this.success_audio);
  },

  // Call add.js to add cart item then use updateCart()
  async editCartItem(
    oldQuantity: number,
    oldVariantId: number,
    newVariantId: number,
    sellingPlanId: number,
  ) {
    this.cart_loading = true;
    this.enable_body_scrolling = true;
    this.playAudioIfEnabled(this.click_audio);

    // Item to remove
    let oldFormData = {
      id: oldVariantId.toString(),
      quantity: "0",
    };

    // Item to add
    let newFormData =
      sellingPlanId == 0
        ? {
            id: newVariantId.toString(),
            quantity: oldQuantity.toString(),
          }
        : {
            id: newVariantId.toString(),
            quantity: oldQuantity.toString(),
            selling_plan: sellingPlanId.toString(),
          };

    try {
      // Remove item
      const oldResponse = await fetch(
        `${window.Shopify.routes.root}cart/change.js`,
        {
          method: "POST",
          body: JSON.stringify(oldFormData),
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
      if (!oldResponse.ok) {
        throw new Error(`HTTP error! status: ${oldResponse.status}`);
      }

      // Add item
      const addResponse = await fetch(
        `${window.Shopify.routes.root}cart/add.js`,
        {
          method: "POST",
          body: JSON.stringify(newFormData),
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
      if (!addResponse.ok) {
        throw new Error(`HTTP error! status: ${addResponse.status}`);
      }

      const data = await addResponse.json();

      // Good response
      if (addResponse.status === 200) {
        this.playAudioIfEnabled(this.success_audio);
        this.updateCart(false);
      }

      // Error response
      else {
        this.error_message = data.description;
        this.error_alert = true;
        this.cart_loading = false;
      }
    } catch (error) {
      console.error("Error:", error);
      this.cart_loading = false;
    }
  },

  // Add cart item by submitting form
  submitCartForm(form: HTMLFormElement, openCart: boolean) {
    this.cart_loading = true;
    this.enable_body_scrolling = true;
    this.playAudioIfEnabled(this.click_audio);
    let formData = new FormData(form);

    // Add properties to formData
    let propertiesObj: Record<string, FormDataEntryValue> = Array.from(formData.entries())
      .filter(([key]) => key.includes("properties"))
      .reduce((obj, [key, value]) => {
        let name = key.replace("properties[", "").replace("]", "");
        obj[name] = value;
        return obj;
      }, {} as Record<string, FormDataEntryValue>);
      
    if (Object.keys(propertiesObj).length > 0) {
      for (const [key, value] of Object.entries(propertiesObj)) {
        formData.append(`properties[${key}]`, value as string);
      }
    }

    // Remove selling_plan if it is set to 0
    for (let pair of formData.entries()) {
      if (pair[0] === "selling_plan" && pair[1] === "0") {
        formData.delete(pair[0]);
      }
    }

    // Make a POST request to add item to cart
    fetch(`${window.Shopify.routes.root}cart/add.js`, {
      method: "POST",
      body: formData,
    })
      .then(async (response) => {
        let data = await response.json();

        // Good response
        if (response.status === 200) {
          this.playAudioIfEnabled(this.success_audio);
          this.updateCart(openCart);
        }

        // Error response
        else {
          this.error_message = data.description;
          this.error_alert = true;
          this.cart_loading = false;
        }
      })
      .catch((error) => {
        console.error("Error:", error);
        this.cart_loading = false;
      });
  },

  // Load quick add with section render
  async fetchAndRenderQuickAdd(product_handle: string) {
    // Get data from Shopify
    try {
      const response = await fetch(
        `${window.Shopify.routes.root}products/${product_handle}?section_id=quick-add`,
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
      const quickAddContainer = document.getElementById(`js-quickAdd`);
      if (quickAddContainer) {
        quickAddContainer.innerHTML = responseHtml;
        this.loadImages();
      } else {
        console.error(`Element 'js-quickAdd' not found.`);
      }
    } catch (error) {
      console.error(error);
    }
  },

  // Optimized cart sorting with memoization
  sortCartItems() {
    const currentHash = this._generateCartHash(this.cart.items);
    
    // Return cached results if cart hasn't changed
    if (currentHash === this._lastCartItemsHash && this._memoizedSummary && this._memoizedGroupedItems) {
      this.cart.summary = this._memoizedSummary;
      this.cart.groupedItems = this._memoizedGroupedItems;
      return;
    }

    // Create summary and grouped items more efficiently
    const summary: Record<string, any> = {};
    const groupedItems: Record<string, any> = {};
    const variantMap: Record<string, any> = {};

    // Single pass through items to build summary, grouped items, and variant map
    for (const item of this.cart.items) {
      const productId = item.product_id;
      const variantId = item.variant_id;
      
      // Build summary
      if (!summary[productId]) {
        summary[productId] = {
          product_title: item.product_title,
          quantity: 0,
          total_final_line_price: 0,
        };
      }
      summary[productId].quantity += item.quantity;
      summary[productId].total_final_line_price += item.final_line_price;

      // Build grouped items
      if (!groupedItems[productId]) {
        groupedItems[productId] = {
          product_title: item.product_title,
          featured_image: item.featured_image,
          handle: item.handle,
          product_has_only_default_variant: item.product_has_only_default_variant,
          url: item.url,
          items: [],
        };
      }
      groupedItems[productId].items.push(item);

      // Build variant map for O(1) lookups
      variantMap[variantId] = item;
    }

    // Cache results
    this._lastCartItemsHash = currentHash;
    this._memoizedSummary = summary;
    this._memoizedGroupedItems = groupedItems;
    
    // Set cart properties
    this.cart.summary = summary;
    this.cart.groupedItems = groupedItems;
    this.cart.variantMap = variantMap;
  },

  // Display discount alert if  URL parameters contain '/discount'
  // e.g. - .com/discount/13KS94BNGCS8?dt=Save+20percent+storewide
  handleSharedDiscount() {
    const discountCode = this.getCookie("discount_code");
    const urlParams = new URLSearchParams(window.location.search);
    const discountText = urlParams.get("dt");
    if (discountText) {
      this.discount_code = discountCode;
      this.discount_text = discountText;
      this.discount_alert = true;
    }
  },

  // Add items to cart if cartshare url available
  handleSharedCart() {
    // Check if URL contains cartshare
    if (location.search.includes("cartshare")) {
      const query = location.search.substring(1);
      const queryArray = query.split("&");

      // Use map to transform the array
      const itemsArray = queryArray
        .map((item) => {
          // Create object with all items to add
          if (item) {
            const properties = item.split(",");
            const obj: { [key: string]: string } = {};
            for (const property of properties) {
              const [key, value] = property.split("=");
              obj[key] = value;
            }
            return obj;
          }
          return null;
        })
        .filter(Boolean) as Array<{ [key: string]: string }>;

      // Filter out the object with cartshare property
      const filteredItemsArray = itemsArray.filter(
        (obj) => !obj.hasOwnProperty("cartshare"),
      );

      // Create itemsObject from filteredItemsArray
      const itemsObject = filteredItemsArray.map((obj) => ({
        variantId: Number(obj.id),
        quantity: Number(obj.q) || 1,
      }));

      // Add items and open cart
      this.addCartItems(itemsObject);
    }
  },

  // Generate url with query string based on cart contents
  generateUrl(): string {
    const params = this.cart.items.map(
      (item: any) => `id=${item.variant_id},q=${item.quantity}`,
    );

    return `${window.location.origin}?cartshare=true&${params.join("&")}`;
  },

  // Cleanup method to prevent memory leaks
  cleanup() {
    // Clear all pending timeouts
    this.debounceTimeouts.forEach((timeout: NodeJS.Timeout) => {
      clearTimeout(timeout);
    });
    this.debounceTimeouts.clear();
    
    // Clear memoization cache
    this._lastCartItemsHash = '';
    this._memoizedSummary = null;
    this._memoizedGroupedItems = null;
  },
};
