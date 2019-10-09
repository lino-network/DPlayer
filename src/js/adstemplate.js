class AdsTemplate {
    constructor (options) {
        this.container = options.container;
        this.options = options.options;
        this.init();
    }

    init () {
        // ads controller mask
        this.controllerMask = this.container.querySelector('.dplayer-ads-controller-mask');

        // ads container
        this.adsContainer = this.container.querySelector('.dplayer-ads');

        // ads controller
        this.controller = this.container.querySelector('.dplayer-ads-controller');
        this.playButton = this.container.querySelector('.dplayer-ads-play-icon');
        this.volumeBar = this.container.querySelector('.dplayer-ads-volume-bar-inner');
        this.volumeBarWrap = this.container.querySelector('.dplayer-ads-volume-bar');
        this.volumeBarWrapWrap = this.container.querySelector('.dplayer-ads-volume-bar-wrap');
        this.volumeButton = this.container.querySelector('.dplayer-ads-volume');
        this.volumeButtonIcon = this.container.querySelector('.dplayer-ads-volume-icon');
        this.volumeIcon = this.container.querySelector('.dplayer-ads-volume-icon .dplayer-icon-content');
        this.ptime = this.container.querySelector('.dplayer-ads-ptime');
        this.dtime = this.container.querySelector('.dplayer-ads-dtime');
        this.theaterToggle = this.container.querySelector('.dplayer-ads-theater-icon');
        this.browserFullButton = this.container.querySelector('.dplayer-ads-full-icon');
        this.webFullButton = this.container.querySelector('.dplayer-ads-full-in-icon');
    }
}

export default AdsTemplate;