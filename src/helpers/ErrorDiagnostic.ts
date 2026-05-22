import fs from 'fs/promises'
import path from 'path'
import type { Page } from 'patchright'
import { classifyRewardsPage } from '../automation/PageController'

export async function errorDiagnostic(page: Page, error: Error): Promise<void> {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        const folderName = `error-${timestamp}`
        const outputDir = path.join(process.cwd(), 'diagnostics', folderName)

        if (!page) {
            return
        }

        if (page.isClosed()) {
            return
        }

        const [htmlContent, screenshotBuffer, title, dashboardApi] = await Promise.all([
            page.content(),
            page.screenshot({ fullPage: true, type: 'png' }),
            page.title().catch(() => ''),
            page
                .evaluate(async () => {
                    try {
                        const response = await fetch('https://rewards.bing.com/api/getuserinfo?type=1', {
                            credentials: 'include'
                        })
                        const text = await response.text()
                        return {
                            ok: response.ok,
                            status: response.status,
                            snippet: text.replace(/\s+/g, ' ').slice(0, 1000)
                        }
                    } catch (fetchError) {
                        return {
                            ok: false,
                            status: 0,
                            snippet: fetchError instanceof Error ? fetchError.message : String(fetchError)
                        }
                    }
                })
                .catch(error => ({
                    ok: false,
                    status: 0,
                    snippet: error instanceof Error ? error.message : String(error)
                }))
        ])
        const classification = classifyRewardsPage(htmlContent, page.url(), title)
        const welcomeRecoveryAttempted = /REWARDS-WELCOME|welcome\/onboarding|RewardsWelcomeError/i.test(
            `${error.name}\n${error.message}\n${error.stack ?? ''}`
        )

        // Error log content
        const errorLog = `
Name: ${error.name}
Message: ${error.message}
Timestamp: ${new Date().toISOString()}
URL: ${page.url()}
Title: ${title || '(empty)'}
Rewards page classification: ${classification.kind} (${classification.reason})
Welcome recovery attempted: ${welcomeRecoveryAttempted}
Dashboard API: ok=${dashboardApi.ok} status=${dashboardApi.status}
Dashboard API snippet: ${dashboardApi.snippet || '(empty)'}
---------------------------------------------------
Stack Trace:
${error.stack || 'No stack trace available'}
        `.trim()

        await fs.mkdir(outputDir, { recursive: true })

        await Promise.all([
            fs.writeFile(path.join(outputDir, 'dump.html'), htmlContent),
            fs.writeFile(path.join(outputDir, 'screenshot.png'), screenshotBuffer),
            fs.writeFile(path.join(outputDir, 'error.txt'), errorLog)
        ])

        console.log(`Diagnostics saved to: ${outputDir}`)
    } catch (error) {
        console.error('Unable to create error diagnostics:', error)
    }
}
