// MV3 service worker entry point.
// S0 skeleton only: the tip button, popup and transaction signing land in S7.
chrome.runtime.onInstalled.addListener(() => {
  console.debug('[tipvault] service worker installed');
});
