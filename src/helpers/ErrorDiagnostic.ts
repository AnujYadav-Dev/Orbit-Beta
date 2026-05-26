import fs from 'fs/promises'
import path from 'path'
import type { Page } from 'patchright'

function formatDiagnosticFailure(error: unknown): string {
    return error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}`.trim() : String(error)
}

export async function errorDiagnostic(page: Page, error: Error, level: 'error' | 'warn' = 'error'): Promise<void> {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        const folderName = `${level}-${timestamp}`
        const outputDir = path.join(process.cwd(), 'diagnostics', folderName)

        if (!page) {
            return
        }

        if (page.isClosed()) {
            return
        }

        const label = level === 'warn' ? 'Warning' : 'Error'
        const errorLog = `
Level: ${level.toUpperCase()}
Name: ${error.name}
Message: ${error.message}
Timestamp: ${new Date().toISOString()}
---------------------------------------------------
${label} Stack Trace:
${error.stack || 'No stack trace available'}
        `.trim()

        await fs.mkdir(outputDir, { recursive: true })
        await fs.writeFile(path.join(outputDir, 'error.txt'), errorLog)

        const [htmlResult, screenshotResult] = await Promise.allSettled([
            page.content(),
            page.screenshot({ fullPage: true, type: 'png' })
        ])

        if (htmlResult.status === 'fulfilled') {
            await fs.writeFile(path.join(outputDir, 'dump.html'), htmlResult.value)
        } else {
            await fs.writeFile(path.join(outputDir, 'dump-error.txt'), formatDiagnosticFailure(htmlResult.reason))
        }

        if (screenshotResult.status === 'fulfilled') {
            await fs.writeFile(path.join(outputDir, 'screenshot.png'), screenshotResult.value)
        } else {
            await fs.writeFile(
                path.join(outputDir, 'screenshot-error.txt'),
                formatDiagnosticFailure(screenshotResult.reason)
            )
        }

        console.log(`Diagnostics saved to: ${outputDir}`)
    } catch (error) {
        console.error('Unable to create error diagnostics:', error)
    }
}
