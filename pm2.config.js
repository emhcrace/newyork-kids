module.exports = {
  apps: [
    {
      name: "newyork-kids-dev",
      script: "npm",
      args: "start",
      watch: ["src", "public", "tailwind.config.js", "postcss.config.js"],
      ignore_watch: ["node_modules", "build", "tmp_parse.txt"],
      env: {
        NODE_ENV: "development",
        BROWSER: "none", // prevent auto-opening a browser when running under pm2
        HOST: "0.0.0.0",
        PORT: "3000",
      },
      max_memory_restart: "1G",
    },
  ],
};
