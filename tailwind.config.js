/** @type {import('tailwindcss').Config} */
// Each color class reads a CSS variable. The light / dark values live in components/theme.ts
// (from ../ColorsGuide.md) and are set on the root View by ThemeProvider, so classes switch with the theme.
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}", "./context/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        canvas: token("canvas"), // the page, furthest back
        surface: token("surface"), // cards, rows
        inset: token("inset"), // icon wells, tracks
        hairline: token("hairline"), // borders only
        edge: token("edge"), // 1.5px outline on secondary boxes
        slate: token("slate"), // brand fill, hero block
        charcoal: token("charcoal"), // deep anchor
        ink: token("ink"), // primary text
        muted: token("muted"), // secondary text
        onDark: token("on-dark"), // text on dark fills
        onAccent: token("on-accent"), // text on a filled accent
        danger: token("danger"), // invalid input outline
        accent: { DEFAULT: token("accent"), tint: token("accent-tint"), ink: token("accent-ink") }, // the app's one accent (sky)
      },
      fontFamily: {
        inter: ["Inter_400Regular"],
        "inter-medium": ["Inter_500Medium"],
        "inter-semibold": ["Inter_600SemiBold"],
        "inter-bold": ["Inter_700Bold"],
      },
    },
  },
  plugins: [],
};
