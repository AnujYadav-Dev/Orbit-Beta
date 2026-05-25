import type { BrowserFingerprintWithHeaders } from 'fingerprint-generator'
import fs from 'fs'
import type { Cookie } from 'patchright'
import path from 'path'

import type { Account, ConfigSaveFingerprint } from '../types/Account'
import type { Config } from '../types/Config'
import { validateAccounts, validateConfig } from './SchemaValidator'
import { getPool, isCloudMode } from './Database'

let configCache: Config

function getSessionDir(sessionPath: string, email: string): string {
    return path.resolve(process.cwd(), sessionPath, email)
}

function getLegacySessionDir(sessionPath: string, email: string): string {
    return path.join(__dirname, '../automation/', sessionPath, email)
}

function resolveSessionFile(sessionPath: string, email: string, fileName: string): string {
    const primary = path.join(getSessionDir(sessionPath, email), fileName)
    if (fs.existsSync(primary)) return primary

    const legacy = path.join(getLegacySessionDir(sessionPath, email), fileName)
    if (fs.existsSync(legacy)) {
        console.warn(`[CONFIG] Using legacy session data from ${path.relative(process.cwd(), legacy)}`)
        return legacy
    }

    return primary
}

function resolveFirstExistingFile(candidates: string[], label: string): string {
    const primaryCandidate = candidates[0]

    for (const candidate of candidates) {
        const candidatePath = path.join(__dirname, '../', candidate)

        if (fs.existsSync(candidatePath)) {
            if (candidate !== primaryCandidate) {
                console.warn(`[CONFIG] ${primaryCandidate} not found, using ${candidate}`)
            }

            return candidatePath
        }
    }

    throw new Error(`[CONFIG] Missing ${label}. Expected one of: ${candidates.join(', ')}`)
}

export function loadAccounts(): Account[] {
    try {
        // Cloud mode: read from ACCOUNTS_JSON environment variable
        if (isCloudMode() && process.env.ACCOUNTS_JSON) {
            console.log('[CONFIG] Loading accounts from ACCOUNTS_JSON environment variable')
            const accountsData = JSON.parse(process.env.ACCOUNTS_JSON)
            validateAccounts(accountsData)
            return accountsData
        }

        // Local mode: read from file (original behavior)
        const accountCandidates = process.argv.includes('-dev')
            ? ['accounts.dev.json', 'accounts.json', 'accounts.example.json']
            : ['accounts.json', 'accounts.example.json']

        const accountDir = resolveFirstExistingFile(accountCandidates, 'accounts file')
        const accounts = fs.readFileSync(accountDir, 'utf-8')
        const accountsData = JSON.parse(accounts)

        validateAccounts(accountsData)

        return accountsData
    } catch (error) {
        throw new Error(error as string)
    }
}

export function loadConfig(): Config {
    try {
        if (configCache) {
            return configCache
        }

        // Cloud mode: read from CONFIG_JSON environment variable
        if (isCloudMode() && process.env.CONFIG_JSON) {
            console.log('[CONFIG] Loading config from CONFIG_JSON environment variable')
            const configData = JSON.parse(process.env.CONFIG_JSON)
            validateConfig(configData)

            // Force headless mode in cloud/CI environments, but honor the configured cluster count.
            configData.headless = true

            configCache = configData
            return configData
        }

        // Local mode: read from file (original behavior)
        const configDir = resolveFirstExistingFile(['config.json', 'config.example.json'], 'config file')
        const config = fs.readFileSync(configDir, 'utf-8')

        const configData = JSON.parse(config)
        validateConfig(configData)

        configCache = configData

        return configData
    } catch (error) {
        throw new Error(error as string)
    }
}

export interface StorageOrigin {
    origin: string
    localStorage: Array<{ name: string; value: string }>
}

// ─── Cloud DB Session Helpers ────────────────────────────────────────────────

async function loadSessionDataFromDB(email: string, type: string): Promise<any | null> {
    const db = getPool()
    if (!db) return null

    const result = await db.query('SELECT data FROM sessions WHERE email = $1 AND type = $2', [email, type])
    if (result.rows.length > 0) {
        return result.rows[0]?.data ?? null
    }
    return null
}

async function saveSessionDataToDB(email: string, type: string, data: any): Promise<void> {
    const db = getPool()
    if (!db) return

    await db.query(
        `INSERT INTO sessions (email, type, data, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (email, type) DO UPDATE
         SET data = EXCLUDED.data, updated_at = NOW()`,
        [email, type, JSON.stringify(data)]
    )
}

// ─── Public Session API ──────────────────────────────────────────────────────

export async function loadSessionData(
    sessionPath: string,
    email: string,
    saveFingerprint: ConfigSaveFingerprint,
    isMobile: boolean
) {
    try {
        const platform = isMobile ? 'mobile' : 'desktop'

        // ── Cloud mode: load from Neon DB ──
        if (isCloudMode()) {
            const cookies: Cookie[] = (await loadSessionDataFromDB(email, `cookies_${platform}`)) ?? []

            let fingerprint!: BrowserFingerprintWithHeaders
            const shouldLoadFingerprint = isMobile ? saveFingerprint.mobile : saveFingerprint.desktop
            if (shouldLoadFingerprint) {
                const fp = await loadSessionDataFromDB(email, `fingerprint_${platform}`)
                if (fp) fingerprint = fp
            }

            const storageState: StorageOrigin[] | undefined =
                (await loadSessionDataFromDB(email, `storage_${platform}`)) ?? undefined

            return {
                cookies,
                fingerprint,
                storageState
            }
        }

        // ── Local mode: original file-based loading ──
        const cookiesFileName = isMobile ? 'session_mobile.json' : 'session_desktop.json'
        const cookieFile = resolveSessionFile(sessionPath, email, cookiesFileName)

        let cookies: Cookie[] = []
        if (fs.existsSync(cookieFile)) {
            const cookiesData = await fs.promises.readFile(cookieFile, 'utf-8')
            cookies = JSON.parse(cookiesData)
        }

        const fingerprintFileName = isMobile ? 'session_fingerprint_mobile.json' : 'session_fingerprint_desktop.json'
        const fingerprintFile = resolveSessionFile(sessionPath, email, fingerprintFileName)

        let fingerprint!: BrowserFingerprintWithHeaders
        const shouldLoadFingerprint = isMobile ? saveFingerprint.mobile : saveFingerprint.desktop
        if (shouldLoadFingerprint && fs.existsSync(fingerprintFile)) {
            const fingerprintData = await fs.promises.readFile(fingerprintFile, 'utf-8')
            fingerprint = JSON.parse(fingerprintData)
        }

        // Load localStorage/sessionStorage data
        const storageFileName = isMobile ? 'session_storage_mobile.json' : 'session_storage_desktop.json'
        const storageFile = resolveSessionFile(sessionPath, email, storageFileName)

        let storageState: StorageOrigin[] | undefined
        if (fs.existsSync(storageFile)) {
            const storageData = await fs.promises.readFile(storageFile, 'utf-8')
            storageState = JSON.parse(storageData)
        }

        return {
            cookies: cookies,
            fingerprint: fingerprint,
            storageState: storageState
        }
    } catch (error) {
        throw new Error(error as string)
    }
}

export async function saveSessionData(
    sessionPath: string,
    cookies: Cookie[],
    email: string,
    isMobile: boolean
): Promise<string> {
    try {
        const platform = isMobile ? 'mobile' : 'desktop'

        // ── Cloud mode: save to Neon DB ──
        if (isCloudMode()) {
            await saveSessionDataToDB(email, `cookies_${platform}`, cookies)
            return `db://sessions/${email}/cookies_${platform}`
        }

        // ── Local mode: original file-based saving ──
        const sessionDir = getSessionDir(sessionPath, email)
        const cookiesFileName = isMobile ? 'session_mobile.json' : 'session_desktop.json'

        if (!fs.existsSync(sessionDir)) {
            await fs.promises.mkdir(sessionDir, { recursive: true })
        }

        await fs.promises.writeFile(path.join(sessionDir, cookiesFileName), JSON.stringify(cookies))

        return sessionDir
    } catch (error) {
        throw new Error(error as string)
    }
}

export async function saveFingerprintData(
    sessionPath: string,
    email: string,
    isMobile: boolean,
    fingerpint: BrowserFingerprintWithHeaders
): Promise<string> {
    try {
        const platform = isMobile ? 'mobile' : 'desktop'

        // ── Cloud mode: save to Neon DB ──
        if (isCloudMode()) {
            await saveSessionDataToDB(email, `fingerprint_${platform}`, fingerpint)
            return `db://sessions/${email}/fingerprint_${platform}`
        }

        // ── Local mode: original file-based saving ──
        const sessionDir = getSessionDir(sessionPath, email)
        const fingerprintFileName = isMobile ? 'session_fingerprint_mobile.json' : 'session_fingerprint_desktop.json'

        if (!fs.existsSync(sessionDir)) {
            await fs.promises.mkdir(sessionDir, { recursive: true })
        }

        await fs.promises.writeFile(path.join(sessionDir, fingerprintFileName), JSON.stringify(fingerpint))

        return sessionDir
    } catch (error) {
        throw new Error(error as string)
    }
}

export async function saveStorageState(
    sessionPath: string,
    storageState: StorageOrigin[],
    email: string,
    isMobile: boolean
): Promise<void> {
    try {
        const platform = isMobile ? 'mobile' : 'desktop'

        // ── Cloud mode: save to Neon DB ──
        if (isCloudMode()) {
            await saveSessionDataToDB(email, `storage_${platform}`, storageState)
            return
        }

        // ── Local mode: original file-based saving ──
        const sessionDir = getSessionDir(sessionPath, email)
        const storageFileName = isMobile ? 'session_storage_mobile.json' : 'session_storage_desktop.json'

        if (!fs.existsSync(sessionDir)) {
            await fs.promises.mkdir(sessionDir, { recursive: true })
        }

        await fs.promises.writeFile(path.join(sessionDir, storageFileName), JSON.stringify(storageState))
    } catch (error) {
        throw new Error(error as string)
    }
}
