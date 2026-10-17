// Keep shared assets, plugins and the EAS project in app.json.
module.exports = ({ config }) => {
  const variant = process.env.APP_VARIANT || "preview";
  if (!["development", "preview"].includes(variant)) {
    throw new Error(`Unsupported APP_VARIANT: ${variant}`);
  }
  const isDevelopment = variant === "development";

  return {
    ...config,
    name: isDevelopment ? "Cycling Dev" : "Cycling Preview",
    scheme: isDevelopment ? "cycling-dev" : "cycling",
    android: {
      ...config.android,
      package: isDevelopment ? "com.cycling.app.dev" : "com.cycling.app",
    },
    plugins: [
      ...(config.plugins || []),
      ["expo-dev-client", { addGeneratedScheme: isDevelopment }],
    ],
  };
};
