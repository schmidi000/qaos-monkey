// @ts-check

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  tutorialSidebar: [
    "intro",
    {
      type: "category",
      label: "Using QAosMonkey",
      collapsed: false,
      items: ["smoke-testing", "configuration", "credentials"]
    }
  ]
};

module.exports = sidebars;

