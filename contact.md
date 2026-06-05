---
layout: default
title: "Contact"
permalink: /contact/
---

<section class="page-hero">
  <div class="container">
    <span class="page-hero__eyebrow">Contact</span>
    <h1 class="page-hero__title">
      Parlons de<br>votre <em>projet</em>
    </h1>
  </div>
</section>

<section class="page-content">
  <div class="container">
    <div class="page-content__text">
      <p>
        Vous avez un projet en tête ? Une commande éditoriale, un reportage,
        une collaboration artistique ? Je suis disponible pour en discuter.
      </p>
      <p>
        Réponse sous 48 h en semaine.
      </p>

      <!-- Formulaire — Netlify Forms / Formspree / etc. -->
      <!-- Pour GitHub Pages : utilisez Formspree (gratuit) -->
      <!-- 1. Créez un compte sur formspree.io -->
      <!-- 2. Remplacez YOUR_FORM_ID ci-dessous par votre identifiant -->

      <form
        class="contact-form"
        action="https://formspree.io/f/YOUR_FORM_ID"
        method="POST"
      >
        <div class="contact-form__group">
          <label class="contact-form__label" for="name">Nom</label>
          <input
            class="contact-form__input"
            type="text"
            id="name"
            name="name"
            placeholder="Votre nom"
            required
          />
        </div>

        <div class="contact-form__group">
          <label class="contact-form__label" for="email">Email</label>
          <input
            class="contact-form__input"
            type="email"
            id="email"
            name="email"
            placeholder="votre@email.com"
            required
          />
        </div>

        <div class="contact-form__group">
          <label class="contact-form__label" for="subject">Sujet</label>
          <input
            class="contact-form__input"
            type="text"
            id="subject"
            name="subject"
            placeholder="Commande éditoriale, projet personnel…"
          />
        </div>

        <div class="contact-form__group">
          <label class="contact-form__label" for="message">Message</label>
          <textarea
            class="contact-form__textarea"
            id="message"
            name="message"
            placeholder="Décrivez votre projet…"
            required
          ></textarea>
        </div>

        <button type="submit" class="contact-form__submit">
          Envoyer le message
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </button>
      </form>
    </div>

    <div class="page-content__text" style="padding-top: 0.5rem;">
      <h2>Informations</h2>
      <p>
        <strong style="color: #f0ece3; font-weight: 400;">Email</strong><br>
        {{ site.email }}
      </p>
      <p style="margin-top: 1.5rem;">
        <strong style="color: #f0ece3; font-weight: 400;">Localisation</strong><br>
        Paris, France<br>
        Déplacements possibles
      </p>
    </div>
  </div>
</section>
