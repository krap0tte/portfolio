import { test, expect } from '@playwright/test';

test('la grille affiche des photos et le clic ouvre/ferme la lightbox', async ({ page }) => {
  await page.goto('/');

  const cards = page.locator('.gallery-card');
  await expect(cards.first()).toBeVisible();

  const lightbox = page.locator('.lightbox');
  await expect(lightbox).not.toHaveClass(/is-open/);

  await cards.first().click();

  await expect(lightbox).toHaveClass(/is-open/);
  await expect(page.locator('.lightbox__img')).toHaveAttribute('src', /.+/);

  await page.getByRole('button', { name: 'Retour à la grille' }).click();
  await expect(lightbox).not.toHaveClass(/is-open/);
});
