import { useEffect } from "react";
import Head from "next/head";

export default function MyApp({ Component, pageProps }) {
  useEffect(() => {
    // Enregistre le Service Worker pour le mode PWA installable
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => console.log("SW enregistré:", reg.scope))
        .catch((err) => console.warn("SW non enregistré:", err));
    }
  }, []);

  return (
    <>
      <Head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <meta name="theme-color" content="#1e1b4b" />
        <meta name="description" content="Correction d'exercices scolaires par IA — adapté à ton niveau" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="EduCorrect" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <title>EduCorrect — Assistant Pédagogique IA</title>
      </Head>
      <Component {...pageProps} />
    </>
  );
}
