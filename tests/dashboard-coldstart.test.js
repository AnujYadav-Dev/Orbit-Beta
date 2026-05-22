const assert = require('assert/strict')
const fs = require('fs')
const path = require('path')
const test = require('node:test')

require('ts-node/register')

const {
    classifyRewardsPage,
    parseDashboardHtmlPayload,
    RewardsWelcomeError,
    default: PageController
} = require('../src/automation/PageController.ts')

function dashboardFixture(points = 42) {
    return {
        userStatus: {
            availablePoints: points,
            counters: {}
        },
        userProfile: {
            attributes: {
                country: 'US'
            }
        },
        dailySetPromotions: {},
        morePromotions: []
    }
}

test('classifies saved coldstart diagnostics as welcome and throws actionable error', () => {
    const diagnosticHtml = path.join(
        __dirname,
        '..',
        'bot-diagnostics',
        'error-2026-05-22T20-15-18-540Z',
        'dump.html'
    )
    const html = fs.existsSync(diagnosticHtml)
        ? fs.readFileSync(diagnosticHtml, 'utf8')
        : '<html class="rewards-coldstart"><head><title>Welcome to Microsoft Rewards</title><meta name="pageid" content="rewards-coldstart"></head></html>'

    const classification = classifyRewardsPage(html, 'https://rewards.bing.com/welcome', 'Welcome to Microsoft Rewards')

    assert.equal(classification.kind, 'welcome')
    assert.throws(() => parseDashboardHtmlPayload(html), RewardsWelcomeError)
})

test('parses legacy dashboard embed with nested JSON', () => {
    const expected = dashboardFixture(101)
    const html = `<html><script>var dashboard = ${JSON.stringify(expected)};</script></html>`

    const parsed = parseDashboardHtmlPayload(html)

    assert.equal(parsed.userStatus.availablePoints, 101)
})

test('parses Next.js flight chunk dashboard payload', () => {
    const expected = dashboardFixture(202)
    const flight = `1:["$","main",null,${JSON.stringify(expected)}]`
    const html = `<html><script>self.__next_f.push(${JSON.stringify([1, flight])})</script></html>`

    const parsed = parseDashboardHtmlPayload(html)

    assert.equal(parsed.userStatus.availablePoints, 202)
})

test('dashboard API response takes precedence over HTML fallback', async () => {
    const expected = dashboardFixture(303)
    let calls = 0
    const bot = {
        axios: {
            request: async () => {
                calls++
                return { data: { dashboard: expected } }
            }
        },
        fingerprint: { headers: {} },
        cookies: { mobile: [] },
        logger: {
            warn: () => undefined,
            error: () => undefined,
            debug: () => undefined
        },
        isMobile: true
    }
    const controller = new PageController(bot)

    const parsed = await controller.getDashboardData()

    assert.equal(parsed.userStatus.availablePoints, 303)
    assert.equal(calls, 1)
})
