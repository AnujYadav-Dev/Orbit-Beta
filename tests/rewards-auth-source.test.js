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
