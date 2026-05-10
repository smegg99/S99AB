// web/app.config.ts
//
// Layer defaults. An app overrides any of these under the same s99ab key.

export default defineAppConfig({
  s99ab: {
    // The named look's texture. Colours are built by createVuetify before app
    // config exists, so pass the same name to s99abTheme({ palette }).
    palette: 'graphite',
    toast: {
      position: 'bottom-end',
      timeout: { success: 3000, info: 4000, warning: 6000, error: 0 },
      maxVisible: 3,
      // ms between one toast expiring and the next.
      stagger: 220,
      dedupeWindow: 1000,
      // Lifespan bar: 'bottom', 'top', or 'none'.
      progress: 'bottom',
      // The kind's glyph and the dismiss, both overridable per toast. A toast
      // with no other way to close keeps its close button.
      icon: true,
      closable: true,
      // Glyph per kind. `pending` spins, and is what toast.promise() shows.
      icons: {
        success: 'mdi-check-circle-outline',
        info: 'mdi-information-outline',
        warning: 'mdi-alert-outline',
        error: 'mdi-alert-circle-outline',
        pending: 'mdi-loading',
      },
      // The countdown holds while the pointer is on it and while the tab is hidden.
      pauseOnHover: true,
      pauseWhenHidden: true,
    },
    // Storage key for light/dark and contrast. Namespace it when apps share an origin.
    appearance: {
      storageKey: 's99ab.theme',
      // Empty uses `<storageKey>.contrast`.
      contrastKey: '',
      // '' follows the OS with a user override; 'light' or 'dark' pins it.
      lock: '',
    },
    // Animation for a theme or contrast change: cover, cover-in, circle,
    // circle-in, sweep, sweep-up, sweep-start, sweep-end, split, fade, none.
    // A pick made through UiTransitionPicker is remembered and wins.
    themeTransition: {
      transition: 'cover',

      // ms for any shape without an entry in `durations`.
      duration: 240,
      // ms per shape.
      durations: {},

      // Empty uses $vt-easing from styles/_config.scss.
      easing: '',
      easings: {},

      // What `reduced` motion turns every shape into: `fade` or `none`.
      reducedFallback: 'fade',

      // Whether `none` also suspends page CSS transitions, so Vuetify's hover
      // transitions do not ease the swap.
      suppressTransitions: true,

      storageKey: 's99ab.theme.transition',
    },
    motion: {
      level: 'system',
      duration: { fast: 120, base: 200, slow: 320 },
    },
    // `lite` drops backdrop blur, the washed ground, textures and drift for
    // low-power GPUs and WebKitGTK. Colours are unchanged.
    performance: {
      lite: false,
    },
    table: {
      limit: 25,
      searchDebounce: 300,
      // Rows an empty table holds open, capped at `limit`.
      emptyRows: 6,
      perPageOptions: [10, 25, 50, 100],
    },
    // How long work runs before an indicator shows, and how long it stays. See useDelay.
    delay: {
      appearAfter: 220,
      holdFor: 450,
    },
    // useEventSource: whether it sends cookies, and the backoff for reopening
    // after the stream is CLOSED. Native transient retries are unaffected.
    sse: {
      withCredentials: true,
      reconnect: { delay: 1000, maxDelay: 15000, backoff: 2 },
    },
    // Where apireleases is mounted, and how a download card orders and labels platforms.
    releases: {
      apiBase: '/api/v1',
      order: ['linux', 'windows', 'macos'],
      primaryKind: { linux: 'appimage', windows: 'installer' },
    },
    // The folder tree. Drawing-only numbers are --s99ab-tile-* stylesheet knobs.
    explorer: {
      maxDepth: 8,
      foldersFirst: true,
      // The grid's column floor.
      tileMin: 104,
      // Extra or replacement tints beyond the ten in _config.scss, as `#rrggbb`
      // or `r, g, b`. List the name in `accents` to offer it in the folder dialog.
      accentColors: {},
      tile: {
        // 'icon': a glyph or preview with the name under it. 'card': a bordered
        // square with the cover filling it and the name on a strip.
        variant: 'icon',
        aspect: 1,
        fit: 'cover',
        label: 'under',
        hover: 'tint',
        badge: 'count',
        // The ... trigger: 'hover' shows it on hover, 'always' at rest, 'none'
        // leaves the menu to right-click.
        menu: 'hover',
        // A tick in each tile's corner while selecting.
        check: false,
      },
      // File manager defaults. For navigation only, use activate: 'single' and
      // select: 'none'.
      behaviour: {
        activate: 'double',
        select: 'multi',
        // ms a drag waits on a folder before opening it. 0 never opens.
        springOpen: 600,
        keyboard: true,
      },
      // The app's words for pinning. Empty uses the layer's locale strings.
      pin: { add: '', remove: '' },
      // Off until the app's folder record can store the field.
      folderFields: { icon: false, image: false },
    },
    // An SVG mask over a flat fill of one theme token, per surface plane.
    texture: {
      // A file under public/textures, or 'none'.
      name: 'grain',

      // Multiplier over every plane's strength. 0 turns texture off.
      gain: 1,
      // Multiplies every texture's natural tile.
      scale: 1,

      // Empty uses the theme's ink, which follows both variants and the accent.
      ink: '',

      // Ink each plane keeps: most on the ground, least on the well.
      planes: {
        ground: 0.16,
        glass: 0.10,
        chrome: 0.09,
        well: 0.06,
        tiles: 0.08,
        overlay: 0.08,
      },

      // Per-plane texture. Empty follows `name`; 'none' turns that plane off.
      textures: {
        ground: '',
        glass: '',
        chrome: '',
        well: '',
        tiles: '',
        overlay: '',
      },

      // Per-plane tile multiplier. 0 follows `scale`.
      scales: {
        ground: 0,
        glass: 0,
        chrome: 0,
        well: 0,
        tiles: 0,
        overlay: 0,
      },

      // Per-plane ink, usually a theme token. Empty follows `ink`.
      inks: {
        ground: '',
        glass: '',
        chrome: '',
        well: '',
        tiles: '',
        overlay: '',
      },

      // Where the user's pick is stored; it wins over the values above on load.
      storageKey: 's99ab.texture',
    },
    // The WebGL ground (@firecms/neat), drawn over the CSS washes, which remain
    // the fallback. Surfaces show it through their blur, or with .s99ab-port.
    // @firecms/neat is an optional peer, so the app supplies the loader:
    //
    //   flow: { loader: () => import('@firecms/neat') }
    //
    // Without it the ground stays inert and the console says so once.
    flow: {
      enabled: true,
      // Live canvases, the ground included. Browsers cap WebGL contexts, so a
      // UiFlow refused a slot shows the still image.
      maxInstances: 3,
      // Fraction of device pixels the shader renders at.
      resolution: 0.8,

      // @firecms/neat's own options, so a gradient from neat.firecms.co pastes
      // in as-is. Tuned slow and low-contrast for a background.
      speed: 3,
      horizontalPressure: 3,
      verticalPressure: 4,
      waveFrequencyX: 2,
      waveFrequencyY: 3,
      waveAmplitude: 4,
      shadows: 10,
      highlights: 4,
      colorBlending: 3,
      colorSaturation: 1,
      colorBrightness: 1,
      wireframe: false,

      // Values that differ on the dark variant.
      dark: { shadows: 6, highlights: 1, colorBrightness: 0.8, colorSaturation: 2 },

      // Empty derives the stops from `accent`, `warning`, `sunk` and `bg`, so
      // the ground follows the palette.
      colors: [],
      // For @firecms/neat 1.x, which watermarks the canvas without a purchased
      // key. 0.x adds an attribution link instead, which UiFlow removes.
      licenseKey: '',
    },
    // Where the app proxies Kratos's public API. Same origin, because the
    // session cookie belongs to the app's origin.
    kratos: {
      basePath: '/kratos',
      // Kratos types a login identifier as `text`. Set this when the identity
      // schema uses email, so the field is validated as one.
      identifierIsEmail: false,
    },
    // Routes only the app knows. Empty is valid: no signInPath shows the prompt
    // without a link, no signUpPath hides registration, no homePath hides the
    // way out of the signed-out screen.
    auth: {
      signInPath: '',
      signUpPath: '',
      homePath: '',
      settingsPath: '',
      // Extra URL segments for the [flow] page, merged over the defaults.
      flowRoutes: {} as Record<string, string>,
    },
  },
})
