//const plugin = require("tailwindcss/plugin");
//const colors = require("tailwindcss/colors");

module.exports = {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.jsx",
  ],
  theme: {
    colors: {
      'off-white1': '#f0ebd8',
      'off-white2': '#f4ece2',
      'blue1': '#748cab',
      'blue2': '#3e5c76',
      'blue3': '#1d2d44',
      'blue4': '#0d1321',
      'blue5': '#222733',
      'green1': '#a2a182',
      'green2': '#687259',
      'tan': '#e6cebc',
      'red1': '#ba6f4d',
      'red2': '#8e412e',
    },
    extend: {
      boxShadow: {
        '3xl': 'rgba(0, 0, 0, 0.25) 0px 54px 55px, rgba(0, 0, 0, 0.12) 0px -12px 30px, rgba(0, 0, 0, 0.12) 0px 4px 6px, rgba(0, 0, 0, 0.17) 0px 12px 13px, rgba(0, 0, 0, 0.09) 0px -3px 5px',
        '4xl': 'rgb(38, 57, 77) 0px 20px 30px -10px',
        'inner-md': 'rgba(50, 50, 93, 0.25) 0px 50px 100px -20px, rgba(0, 0, 0, 0.3) 0px 30px 60px -30px, rgba(10, 37, 64, 0.35) 0px -2px 6px 0px inset;',
        'inner-lg': 'rgb(204, 219, 232) 3px 3px 6px 0px inset, rgba(255, 255, 255, 0.5) -3px -3px 6px 1px inset',
        'inner-xl': 'rgba(50, 50, 93, 0.25) 0px 30px 60px -12px inset, rgba(0, 0, 0, 0.3) 0px 18px 36px -18px inset',
        'inner-2xl': 'rgba(0, 0, 0, 0.17) 0px -23px 25px 0px inset, rgba(0, 0, 0, 0.15) 0px -36px 30px 0px inset, rgba(0, 0, 0, 0.1) 0px -79px 40px 0px inset, rgba(0, 0, 0, 0.06) 0px 2px 1px, rgba(0, 0, 0, 0.09) 0px 4px 2px, rgba(0, 0, 0, 0.09) 0px 8px 4px, rgba(0, 0, 0, 0.09) 0px 16px 8px, rgba(0, 0, 0, 0.09) 0px 32px 16px'
      },
      minHeight: {
        "screen-75": "75vh",
      },
      backgroundImage: {
        'google-icon': "url('/src/assets/img/google.svg')",
        'duck-icon': "url('/src/assets/img/duck.svg')",
        'wolfram-icon': "url('/src/assets/img/wolfram.svg')",
        'stack-icon': "url('/src/assets/img/stack.svg')",
        'sun-icon': "url('/src/assets/img/sun.svg')",
        'sun-cloud-icon': "url('/src/assets/img/sun-cloud.svg')",
        'wind-icon': "url('/src/assets/img/wind.svg')",
        'humidity-icon': "url('/src/assets/img/humidity.svg')",
      },
    },
  },
};
