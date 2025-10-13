/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
  theme: {
    extend: {
      // 필요에 따라 브랜드 색상 추가 가능
    },
  },
  plugins: [
    require("@tailwindcss/forms"), // 기본 폼 스타일 적용
  ],
};
