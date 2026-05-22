export type RewardsPageAuthState = 'authenticated-dashboard' | 'anonymous-or-onboarding' | 'unknown'

const REWARDS_ANONYMOUS_PATTERNS = [
    /<title>\s*Welcome to Microsoft Rewards\s*<\/title>/i,
    /href=["'][^"']*\/create(?:New)?User\?idru=/i,
    /id=["']rewards-header-sign-in["']/i,
    /id=["']start-earning-rewards-link["']/i,
    /Welcome to Microsoft Rewards/i
]

const REWARDS_DASHBOARD_PATTERNS = [
    /var\s+dashboard\s*=/i,
    /"userStatus"\s*:/i,
    /"availablePoints"\s*:/i,
    /"dailySetPromotions"\s*:/i,
    /<section[^>]+id=["'](?:snapshot|dailyset)["']/i,
    /self\.__next_f\.push/i
]

export function isRewardsAnonymousOrOnboardingPage(html: string, url = ''): boolean {
    const path = safeUrlPath(url)
    if (path === '/welcome' || path.startsWith('/welcome/')) return true

    return REWARDS_ANONYMOUS_PATTERNS.some(pattern => pattern.test(html))
}

export function hasRewardsDashboardSignals(html: string): boolean {
    if (isRewardsAnonymousOrOnboardingPage(html)) return false
    return REWARDS_DASHBOARD_PATTERNS.some(pattern => pattern.test(html))
}

export function classifyRewardsPage(html: string, url = ''): RewardsPageAuthState {
    if (isRewardsAnonymousOrOnboardingPage(html, url)) return 'anonymous-or-onboarding'
    if (hasRewardsDashboardSignals(html)) return 'authenticated-dashboard'
    return 'unknown'
}

function safeUrlPath(url: string): string {
    try {
        return new URL(url).pathname
    } catch {
        return ''
    }
}
