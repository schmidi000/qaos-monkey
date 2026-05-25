import React from "react";
import clsx from "clsx";
import Link from "@docusaurus/Link";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import useBaseUrl from "@docusaurus/useBaseUrl";
import Layout from "@theme/Layout";
import styles from "./index.module.css";

export default function Home() {
  const { siteConfig } = useDocusaurusContext();
  const heroImageUrl = useBaseUrl("/img/hero-illustration.png");

  return (
    <Layout
      title={siteConfig.title}
      description="QAosMonkey is an exploratory testing agent for iOS and Android emulators."
    >
      <main className={styles.homeMain}>
        <section className={styles.heroSection}>
          <div className={styles.heroContent}>
            <p className={styles.eyebrow}>Mobile QA, with teeth</p>
            <h1 className={styles.title}>QAosMonkey</h1>
            <p className={styles.tagline}>
              Exploratory Testing Agent for iOS & Android Emulators
            </p>
            <p className={styles.description}>
              Point QAosMonkey at a simulator, give it a goal, and let it probe
              login flows, forms, navigation, overlays, and weird edge cases.
              Human-in-the-loop prompts and redacted credentials keep the loop
              practical for local and CI runs.
            </p>
            <div className={styles.buttonRow}>
              <Link
                className={clsx("button button--primary button--lg", styles.primaryButton)}
                to="/docs/intro"
              >
                Get Started
              </Link>
              <Link
                className={clsx("button button--secondary button--lg", styles.secondaryButton)}
                href="https://github.com/schmidi000/qaos-monkey"
              >
                GitHub
              </Link>
            </div>
          </div>
          <div className={styles.heroImageWrap}>
            <img
              className={styles.heroImage}
              src={heroImageUrl}
              alt="Cyborg monkey breaking phones"
            />
          </div>
        </section>
      </main>
    </Layout>
  );
}
