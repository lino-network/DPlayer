import Icons from './icons';
import utils from './utils';

const State = {
    UNKNOWN: 'Ads.Unknown',
    UNAVAILABLE: 'Ads.Invalid',
    READY:  'Ads.Ready',
    DISABLED: 'Ads.Disabled',
};

class Ads {
    constructor (options, template, player, adContainer) {
        this.options = options;
        this.player = player;
        this.adContainer = adContainer;
        this.template = template;
        this.paused = true;
        this.AdsState = State;
        this.state = State.UNKNOWN;

        this.resizeCheckIntervalHandle = null;
        this.resizeCheckInterval = 200; // Interval (ms) to check for player resize for fluid support.

        this.playerDimensions = {
            width: this.player.video.clientWidth,
            height: this.player.video.clientHeight,
        };

        if (!options.ads.enabled) {
            this.state = State.DISABLED;
            return;
        }

        if (typeof google === 'undefined') {
            this.state = State.UNAVAILABLE;
            return;
        }

        this.initIMA();
        this.state = State.READY;
    }

    initIMA () {
        google.ima.settings.setLocale(this.options.lang);

        google.ima.settings.setDisableCustomPlaybackForIOS10Plus(true);

        this.adDisplayContainer = new google.ima.AdDisplayContainer(this.adContainer, this.player.video);

        this.adsLoader = new google.ima.AdsLoader(this.adDisplayContainer);

        this.adsManager = null;

        this.adsLoader.addEventListener(
            google.ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED,
            this.onAdsManagerLoaded,
            false,
            this);

        this.adsLoader.addEventListener(
            google.ima.AdErrorEvent.Type.AD_ERROR,
            this.onAdError,
            false,
            this);
    }

    canRun () {
        return this.options.ads.enabled && this.state === State.READY;
    }

    reset () {
        if (this.adsManager) {
            this.adsManager.stop();
            this.adsManager.destroy();
            this.adsManager = null;
        }
    }

    initialUserAction () {
        this.adDisplayContainer.initialize();
    }

    requestAds (adTagUrl, autoplayAllowed, autoplayRequiresMuted) {
        const adsRequest = new google.ima.AdsRequest();
        adsRequest.adTagUrl = adTagUrl;
        adsRequest.linearAdSlotWidth = this.player.video.clientWidth;
        adsRequest.linearAdSlotHeight = this.player.video.clientHeight;

        adsRequest.nonLinearAdSlotWidth = this.player.video.clientWidth;
        adsRequest.nonLinearAdSlotHeight = this.player.video.clientHeight;

        adsRequest.setAdWillAutoPlay(autoplayAllowed);
        adsRequest.setAdWillPlayMuted(autoplayRequiresMuted);
        this.adsLoader.requestAds(adsRequest);
    }

    /**
     * Pause ads
     */
    pause () {
        if (this.adsManager) {
            this.adsPaused = true;
            this.adsManager.pause();
            this.template.playButton.innerHTML = Icons.play;
        }
    }

    /**
     * Resume ads
     */
    resume () {
        if (this.adsManager) {
            this.adsPaused = false;
            this.adsManager.resume();
            this.template.playButton.innerHTML = Icons.pause;
        }
    }

    /**
     * Toggle between ads play and pause
     */
    toggle () {
        if (this.adsPaused) {
            this.resume();
        } else {
            this.pause();
        }
    }

    resize (width, height, isFullScreen) {
        if (this.adsManager) {
            const mode = isFullScreen ? google.ima.ViewMode.FULLSCREEN : google.ima.ViewMode.NORMAL;
            this.adsManager.resize(width, height, mode);
        }
    }

    setVolume (volumn) {
        if (this.adsManager) {
            this.adsManager.setVolume(volumn);
        }
    }

    onAdsManagerLoaded (adsManagerLoadedEvent) {
        // Get the ads manager.
        const adsRenderingSettings = new google.ima.AdsRenderingSettings();
        adsRenderingSettings.restoreCustomPlaybackStateOnAdBreakComplete = true;
        adsRenderingSettings.enablePreloading = true;
        adsRenderingSettings.loadVideoTimeout = 4000; // 4s video timeout

        this.adsManager = adsManagerLoadedEvent.getAdsManager(this.player.video, adsRenderingSettings);
        this.setupAdsManager(this.adsManager);
    }

    setupAdsManager (adsManager) {
        adsManager.addEventListener(
            google.ima.AdErrorEvent.Type.AD_ERROR,
            this.onAdError,
            false,
            this);
        adsManager.addEventListener(
            google.ima.AdEvent.Type.CONTENT_PAUSE_REQUESTED,
            this.onContentPauseRequested,
            false,
            this);
        adsManager.addEventListener(
            google.ima.AdEvent.Type.CONTENT_RESUME_REQUESTED,
            this.onContentResumeRequested,
            false,
            this);
        adsManager.addEventListener(
            google.ima.AdEvent.Type.ALL_ADS_COMPLETED,
            this.onAdEvent,
            false,
            this);

        // Listen to any additional events, if necessary.
        const events = [
            google.ima.AdEvent.Type.ALL_ADS_COMPLETED,
            google.ima.AdEvent.Type.CLICK,
            google.ima.AdEvent.Type.COMPLETE,
            google.ima.AdEvent.Type.FIRST_QUARTILE,
            google.ima.AdEvent.Type.LOADED,
            google.ima.AdEvent.Type.MIDPOINT,
            google.ima.AdEvent.Type.STARTED,
            google.ima.AdEvent.Type.PAUSED,
            google.ima.AdEvent.Type.RESUMED,
            google.ima.AdEvent.Type.AD_PROGRESS,
            google.ima.AdEvent.Type.DURATION_CHANGE,
            google.ima.AdEvent.Type.THIRD_QUARTILE];
        for (const index in events) {
            adsManager.addEventListener(
                events[index],
                this.onAdEvent,
                false,
                this);
        }

        adsManager.init(this.player.video.clientWidth,
            this.player.video.clientHeight,
            google.ima.ViewMode.NORMAL);

        adsManager.start();
    }

    onAdError () {
        if (this.adsManager) {
            this.adsManager.destroy();
        }
    }

    /**
     * Fired when content should be paused
     * This usually happens right before an ad is about to cover the content
     */
    onContentPauseRequested () {
        this.adsPaused = false;
        this.player.pauseForAd();
        this.setUpPlayerIntervals();
    }

    /**
     * Fired when content should be resumed
     * This usually happens when an ad finishes or collapses
     */
    onContentResumeRequested () {
        this.adsPaused = true;
        this.clearPlayerIntervals();
        this.player.resumeAfterAd();
    }

    onAdEvent (adEvent) {
        const ad = adEvent.getAd();
        switch (adEvent.type) {
        case google.ima.AdEvent.Type.AD_PROGRESS: {
            const progress = adEvent.getAdData();
            this.template.ptime.innerHTML = utils.secondToTime(progress.currentTime);
            break;
        }
        case google.ima.AdEvent.Type.STARTED: {
            const duration = ad.getDuration();
            if (duration > 0 && duration !== Infinity) {
                this.template.dtime.innerHTML = utils.secondToTime(duration);
            }
            break;
        }
        }
    }

    setUpPlayerIntervals () {
        this.resizeCheckIntervalHandle = setInterval(this.checkForResize.bind(this), this.resizeCheckInterval);
    }

    clearPlayerIntervals () {
        clearInterval(this.resizeCheckIntervalHandle);
    }

    checkForResize () {
        const currentWidth = this.player.video.clientWidth;
        const currentHeight = this.player.video.clientHeight;

        if (currentWidth !== this.playerDimensions.width ||
            currentHeight !== this.playerDimensions.height) {
            const isFullScreen = this.player.fullScreen.isFullScreen('browser');
            this.playerDimensions.width = currentWidth;
            this.playerDimensions.height = currentHeight;
            this.resize(currentWidth, currentHeight, isFullScreen);
        }
    }

    destroy () {
        this.clearPlayerIntervals();
    }
}

export default Ads;