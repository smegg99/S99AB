// tests/browser/consumer.spec.ts
import { expect, test } from '@playwright/test'

for (const width of [390, 1280]) {
  for (const dark of [false, true]) {
    for (const high of [false, true]) {
      for (const language of ['en', 'pl']) {
        test(`${width} ${dark ? 'dark' : 'light'} ${high ? 'high' : 'normal'} ${language}`, async ({ page, request }, info) => {
          const errors: string[] = []
          page.on('pageerror', error => errors.push(error.message))
          page.on('console', (message) => {
            if (message.type() === 'error' || /hydration/i.test(message.text())) errors.push(message.text())
          })
          page.on('requestfailed', request => errors.push(`${request.url()}: ${request.failure()?.errorText}`))
          const html = await (await request.get('/')).text()
          expect(html).toContain('Workspace')
          expect(html).toContain('Downloads')
          await page.setViewportSize({ width, height: 1000 })
          await page.goto('/')
          await expect(page.locator('[data-ready="true"]')).toBeVisible()
          if (dark) await page.getByTestId('mode').click()
          if (high) await page.getByTestId('contrast').click()
          if (language === 'pl') await page.getByTestId('locale').click()
          await expect(page.locator('.v-application')).toHaveClass(dark ? /v-theme--dark/ : /v-theme--light/)
          if (high) await expect(page.locator('html')).toHaveAttribute('data-contrast', 'high')
          await expect(page.locator('.notice')).toContainText(language === 'pl' ? 'Informacje' : 'Release information')
          await expect(page.locator('.v-messages__message')).toHaveCount(1)
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
          const heading = page.locator('.notice .text-title-medium')
          const body = page.locator('.notice .text-body-medium')
          expect(await heading.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThan(await body.evaluate(el => parseFloat(getComputedStyle(el).fontSize)))
          await page.screenshot({ path: info.outputPath('page.png'), fullPage: true })
          await page.getByTestId('menu').click()
          const card = page.getByTestId('menu-card')
          await expect(card).toBeVisible()
          expect(await card.evaluate(el => getComputedStyle(el).borderTopWidth)).toBe('0px')
          for (const row of ['avatar-row', 'image-row', 'icon-row', 'checkbox-row']) {
            const item = page.getByTestId(row)
            const metrics = await item.evaluate((el) => {
              const prepend = el.querySelector('.v-list-item__prepend')!
              const content = el.querySelector('.v-list-item__content')!
              return { right: prepend.firstElementChild!.getBoundingClientRect().right, left: content.getBoundingClientRect().left }
            })
            expect(metrics.left).toBeGreaterThan(metrics.right)
          }
          await page.screenshot({ path: info.outputPath('menu.png'), fullPage: true })
          await page.keyboard.press('Escape')
          await expect(card).not.toBeVisible()
          await expect(page.getByTestId('menu')).toBeFocused()
          expect(errors).toEqual([])
        })
      }
    }
  }
}
