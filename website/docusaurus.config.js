// @ts-check

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: "QAosMonkey",
  tagline: "Exploratory Testing Agent for iOS & Android Emulators",
  favicon: "img/favicon.ico",

  url: "https://qaosmonkey.com",
  baseUrl: "/",
  organizationName: "schmidi000",
  projectName: "qaos-monkey",
  deploymentBranch: "gh-pages",
  trailingSlash: false,

  onBrokenLinks: "throw",
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: "warn"
    }
  },

  i18n: {
    defaultLocale: "en",
    locales: ["en"]
  },

  presets: [
    [
      "classic",
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: require.resolve("./sidebars.js"),
          routeBasePath: "docs",
          showLastUpdateTime: false
        },
        blog: false,
        theme: {
          customCss: require.resolve("./src/css/custom.css")
        }
      })
    ]
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      image: "img/hero-illustration.png",
      navbar: {
        title: "QAosMonkey",
        logo: {
          alt: "QAosMonkey logo",
          src: "img/favicon.ico"
        },
        items: [
          {
            type: "docSidebar",
            sidebarId: "tutorialSidebar",
            position: "left",
            label: "Docs"
          },
          {
            href: "https://github.com/schmidi000/qaos-monkey",
            label: "GitHub",
            position: "right"
          }
        ]
      },
      footer: {
        style: "dark",
        links: [
          {
            title: "Docs",
            items: [
              {
                label: "Introduction",
                to: "/docs/intro"
              },
              {
                label: "Configuration",
                to: "/docs/configuration"
              }
            ]
          },
          {
            title: "Community",
            items: [
              {
                label: "GitHub",
                href: "https://github.com/schmidi000/qaos-monkey"
              }
            ]
          }
        ],
        copyright: `Copyright © ${new Date().getFullYear()} QAosMonkey.`
      },
      prism: {
        theme: require("prism-react-renderer").themes.github,
        darkTheme: require("prism-react-renderer").themes.dracula
      },
      tableOfContents: {
        minHeadingLevel: 2,
        maxHeadingLevel: 4
      },
      docs: {
        sidebar: {
          hideable: true,
          autoCollapseCategories: true
        }
      }
    })
};

module.exports = config;
