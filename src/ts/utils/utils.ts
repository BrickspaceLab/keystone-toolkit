import { ShopifyInterface } from "../models.interface";
let Shopify: ShopifyInterface = window.Shopify || {};
export const utils = {
  
  // Initiate animation setup - classes will swap when elements scroll into view
  initAnimationObserver () {

    // observerCallback for IntersectionObserver
    const observerCallback: IntersectionObserverCallback = function (entries) {
      entries.forEach((entry) => {
        let element = document.getElementById((entry.target as HTMLElement).dataset.id!);
        if (entry.isIntersecting) {

          // Set delay for animation
          const delay = (entry.target as HTMLElement).dataset.delay || '';

          // Use try-catch to handle JSON parsing errors
          let replaceClasses: { [key: string]: string };
          try {
            replaceClasses = JSON.parse(
              (entry.target as HTMLElement).dataset.replace!.replace(/'/g, '"')
            ) as { [key: string]: string };
          } 
          catch (error) {
            console.error('Error parsing replaceClasses:', error);
            return;
          }

          // Avoid using eval due to security risks, instead use a safer alternative
          const callback = (entry.target as HTMLElement).dataset.callback!;
          if (callback && (window as any)[callback] && typeof (window as any)[callback] === "function") {
            (window as any)[callback]();
          }

          // Update classes
          Object.keys(replaceClasses).forEach(function (key) {
            setTimeout(function () {
              if (element) {
                element.classList.remove(key);
                if (replaceClasses[key]) {
                  element.classList.add(replaceClasses[key]);
                }
              } else {
                entry.target.classList.remove(key);
                if (replaceClasses[key]) {
                  entry.target.classList.add(replaceClasses[key]);
                }
              }
            }, parseInt(delay, 10));
          });

        }
      });
    };

    // Get elements with .js-animation
    const animationElements = document.querySelectorAll(".js-animation");
    if (animationElements.length > 0) {
      const animationObserver = new IntersectionObserver(observerCallback);
      animationElements.forEach(function (target) {
        animationObserver.observe(target);
      });
    }
    
  },

  // Refresh when using back button when history states were changed
  initPopstate () {
    window.addEventListener('popstate', async () => {
      window.location.href = location.href;
    });
  },

  // Handle body scrolling - calculates changes while scrolling
  handleBodyScroll () {
    let is_executing = false;
    if (is_executing) return;

    is_executing = true;
    setTimeout(() => {
      if (window.scrollY > 200) {
        this.is_scrolled_up = false;
      } 
      else {
        this.is_scrolled_up = true;
      }
      if (window.scrollY > 100) {
        if (window.scrollY > this.prev_scroll_pos) {
          this.is_scrolled = true;
        } 
        else {
          this.is_scrolled = false;
        }
      } 
      else {
        this.is_scrolled = false;
      }
      this.prev_scroll_pos = window.scrollY;
      is_executing = false;
    }, 100);
  },

  // Match to liquid handle filter
  handleize (
    str: string
  ) {    
    return str
      .toLowerCase()
      .replace(/['"]+/g, '') // Remove prime symbols and quotation marks
      .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric characters with a dash
      .replace(/^-+|-+$/g, '') // Remove leading/trailing dashes
      .replace(/-+/g, '-'); // Replace multiple consecutive dashes with a single dash
  },

  // Encode to base64
  // This should match liquid values like {{ value | replace: ' ', '+' | base64_encode }}
  encodeToBase64 (
    str: string
  ) {
    return btoa(unescape(encodeURIComponent(str)));
  },

  // Add classes to images after loading
  loadImages () {

    // Function to add 'loaded' classes to images and image containers
    const loadImage = (img: HTMLImageElement) => {
      img.classList.add('loaded');
      img.parentElement?.parentElement?.classList.add('loaded');
    };

    // Iterate over each image with .js-image
    const images = document.querySelectorAll('img.js-image');
    images.forEach((img: Element) => {
      const imageElement = img as HTMLImageElement;

      // Timer to slow down image animation
      setTimeout(() => {

        // When image is cached
        if(imageElement.complete){
          loadImage(imageElement);
        } 

        // Check when image loads
        else {
          imageElement.onload = () => {
            loadImage(imageElement);
          }
        }

      }, 300);

      // Set a fallback for adding the classes
      setTimeout(() => {
        loadImage(imageElement); 
      }, 2000);

    });
  },

  // Copy value of input to clipboard and focus element
  copyToClipboard (
    id: string
  ) {
    const copyText = document.getElementById(id) as HTMLInputElement;

    // Check if copyText is not null before proceeding to avoid potential errors
    if(copyText) {
      copyText.select();
      copyText.setSelectionRange(0, 99999);
    
      // Use try-catch to handle potential errors when writing to clipboard
      try {
        navigator.clipboard.writeText(copyText.value);
      } 
      catch (err) {
        console.error('Failed to copy text: ', err);
      }
    } else {
      console.error('Element not found: ', id);
    }
  },
  
  // Get cookie by name
  getCookie (
    name: string
  ) {

    // Using RegExp for more efficient and accurate cookie name matching
    const cookieMatch = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
    return cookieMatch ? cookieMatch.pop() : null;
  },

  // Handle audio playing
  playAudioIfEnabled (
    audioFile: string
  ) {
    if (this.enable_audio) {
      const audio = new Audio(audioFile);
      if (window.innerWidth > 768) {
        audio.play();
      }
    }
  },
  
  // Checks if URL contains account and opens account drawer
  handleOpnedAccount () {
    if (location.search.includes("?account")) {
      this.account_drawer = true;
    }
  },

  // Open menu drawer
  openMenu () {
    this.menu_drawer = true;
    if (this.cart_drawer_style === 'fixed') {
      this.cart_drawer = false; 
    }
    this.playAudioIfEnabled(this.click_audio);
    this.$nextTick(() => {
      const menuDrawer = document.querySelector<HTMLElement>('#theme__menu');
      if (menuDrawer) {
        const focusTarget = menuDrawer.querySelector<HTMLElement>('a');
        focusTarget?.focus();
      }
    });
  },

  // Open cart drawer
  openCart() {
    this.cart_drawer = true;
    this.cart_alert = false;
    if (this.cart_drawer_style === 'fixed') {
      this.menu_drawer = false;
      this.menu_sidebar = false;
    } else {
      this.enable_body_scrolling = false;
    }
    this.playAudioIfEnabled(this.click_audio);
    this.$nextTick(() => {
      const cartDrawer = document.querySelector<HTMLElement>('#theme__cart');
      if (cartDrawer) {
        const focusTarget = cartDrawer.querySelector<HTMLElement>('button');
        focusTarget?.focus();
      }
    });
  },

  // Open cart drawer
  openAccount () {
    this.account_drawer = true; 
    this.enable_body_scrolling = false;
    this.playAudioIfEnabled(this.click_audio);
    this.$nextTick(() => {
      const accountDrawer = document.querySelector<HTMLElement>('#theme__account');
      if (accountDrawer) {
        const focusTarget = accountDrawer.querySelector<HTMLElement>('a');
        focusTarget?.focus();
      }
    });
  },
  
  // Open search drawer
  openSearch () {
    this.search_drawer = true; 
    this.enable_body_scrolling = false; 
    setTimeout(() => {
      let searchField = document.querySelector('#search-field') as HTMLInputElement;
      if (searchField) {
        searchField.focus();
      }
    }, 400);
  },

  // Toggle menu
  toggleMenuDrawer () {
    this.menu_drawer = !this.menu_drawer;
    if (this.cart_drawer_style === 'fixed') {
      this.cart_drawer = false;
    }
    this.playAudioIfEnabled(this.click_audio);
    this.$nextTick(() => {
      const menuDrawer = document.querySelector<HTMLElement>('#theme__menu');
      if (menuDrawer) {
        const focusTarget = menuDrawer.querySelector<HTMLElement>('a');
        focusTarget?.focus();
      }
    });
  },

  // Toggle menu
  toggleMenuSidebar () {
    this.menu_sidebar = !this.menu_sidebar;
    if (this.cart_drawer_style === 'fixed') {
      this.cart_drawer = false;
    }
    this.playAudioIfEnabled(this.click_audio);
    this.$nextTick(() => {
      const menuDrawer = document.querySelector<HTMLElement>('#theme__menu');
      if (menuDrawer) {
        const focusTarget = menuDrawer.querySelector<HTMLElement>('a');
        focusTarget?.focus();
      }
    });
  },

  // Toggle menu
  toggleCart () {
    this.cart_drawer = !this.cart_drawer;
    this.cart_alert = false;
    if (this.cart_drawer_style === 'fixed') {
      this.menu_drawer = false; 
      this.menu_sidebar = false;
    } else {
      if (this.cart_drawer) {
        this.enable_body_scrolling = false;
      }
      else {
        this.enable_body_scrolling = true;
      }
    }
    this.playAudioIfEnabled(this.click_audio);
  },

  // Toggle search
  toggleSearch () {
    this.search_drawer = !this.search_drawer;
    if (this.search_drawer) {
      this.enable_body_scrolling = false;
      setTimeout(() => {
        let searchField = document.querySelector('#search-field') as HTMLInputElement;
        if (searchField) {
          searchField.focus();
        }
      }, 400);
    }
    else {
      this.enable_body_scrolling = true;
    }
  },

  // Close cart drawer
  closeAccount () {
    this.account_drawer = false; 
    this.enable_body_scrolling = true;
  },
  
  // Close cart drawer
  closeCart () {
    this.cart_drawer = false; 
    this.cart_alert = false;
    this.enable_body_scrolling = true;
  },
  
  // Close menu drawer
  closeMenu (){
    this.menu_drawer = false; 
    this.menu_sidebar = false;
    this.enable_body_scrolling = true;
  },
  
  // Close menu drawer
  closeSearch () {
    this.search_drawer = false; 
    this.enable_body_scrolling = true;
  },
  
};