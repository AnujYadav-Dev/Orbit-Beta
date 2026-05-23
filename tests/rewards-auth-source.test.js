const assert = require('assert/strict')
const fs = require('fs')
const path = require('path')
const test = require('node:test')

const root = path.join(__dirname, '..')

function read(file) {
    return fs.readFileSync(path.join(root, file), 'utf8')
}

test('Rewards login detection does not treat every rewards.bing.com page as logged in', () => {
    const auth = read('src/automation/auth/AuthManager.ts')

    assert.doesNotMatch(auth, /On rewards\/account page, assuming logged in/)
    assert.match(auth, /REWARDS_SIGN_IN/)
    assert.match(auth, /classifyRewardsPage/)
})

test('dashboard parser rejects anonymous Rewards welcome pages before parsing dashboard data', () => {
    const controller = read('src/automation/PageController.ts')

    assert.match(controller, /isRewardsAnonymousOrOnboardingPage/)
    assert.match(controller, /welcome\/sign-in page/)
})

test('dashboard fetch has browser API and Next.js RSC fallbacks', () => {
    const controller = read('src/automation/PageController.ts')

    assert.match(controller, /getDashboardDataViaBrowserApi/)
    assert.match(controller, /parseNextDashboardHtml/)
    assert.match(controller, /extractRewardsActivities/)
    assert.match(controller, /Built dashboard data from Next\.js Rewards page payload/)
})

test('dashboard fallback chatter is debug-only and closed pages return cached points', () => {
    const controller = read('src/automation/PageController.ts')

    assert.doesNotMatch(controller, /logger\.warn\(this\.bot\.isMobile, 'GET-DASHBOARD-DATA', 'API failed/)
    assert.match(controller, /Primary API failed, trying HTML fallback/)
    assert.match(controller, /Browser page is closed, returning last known points/)
})

test('dashboard browser fallback does not navigate an active non-dashboard page', () => {
    const controller = read('src/automation/PageController.ts')

    assert.match(controller, /getCurrentPlatformCookies/)
    assert.match(controller, /!this\.bot\.isMobile && this\.bot\.cookies\.desktop\.length > 0/)
    assert.match(controller, /const fallbackPage = this\.isRewardsDashboardPage\(page\) \? page : await page\.context\(\)\.newPage\(\)/)
    assert.match(controller, /const closeFallbackPage = fallbackPage !== page/)
    assert.match(controller, /await fallbackPage\.close\(\)\.catch\(\(\) => \{\}\)/)
    assert.doesNotMatch(controller, /await page\s*\.\s*goto\(this\.bot\.config\.baseURL/)
})
