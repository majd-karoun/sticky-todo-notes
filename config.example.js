// Configuration template - copy to config.js and add your API keys
const CONFIG = {
    WEATHER_API_KEY: 'your_weatherapi_key_here' // Get from weatherapi.com
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
} else {
    window.CONFIG = CONFIG;
}
