const raw = '1:{"props":{"pageProps":{"other": {}, "userStatus":{"availablePoints":100}}}}';
const unescaped = raw.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
const startIndex = unescaped.indexOf('{');
if (startIndex !== -1) {
    try {
        const parsed = JSON.parse(unescaped.substring(startIndex));
        const findDashboard = (obj) => {
            if (!obj || typeof obj !== 'object') return null;
            if (obj.userStatus) return obj;
            for (const key of Object.keys(obj)) {
                const found = findDashboard(obj[key]);
                if (found) return found;
            }
            return null;
        };
        const dashboardData = findDashboard(parsed);
        console.log(dashboardData);
    } catch (e) {
        console.error(e);
    }
}
