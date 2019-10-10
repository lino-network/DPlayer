import Promise from 'promise-polyfill';

import utils from './utils';
import handleOption from './options';
import i18n from './i18n';
import Template from './template';
import AdsTemplate from './adstemplate';
import Icons from './icons';
import Danmaku from './danmaku';
import LiveDanmaku from './livedanmaku';
import Events from './events';
import FullScreen from './fullscreen';
import User from './user';
import Subtitle from './subtitle';
import Bar from './bar';
import Timer from './timer';
import Bezel from './bezel';
import Controller from './controller';
import AdsController from './adscontroller';
import Setting from './setting';
import Comment from './comment';
import HotKey from './hotkey';
import ContextMenu from './contextmenu';
import InfoPanel from './info-panel';
import tplVideo from '../template/video.art';
import Ads from './ads';

let index = 0;
const instances = [];

class DPlayer {

    /**
     * DPlayer constructor function
     *
     * @param {Object} options - See README
     * @constructor
     */
    constructor (options) {
        this.options = handleOption(options);

        if (this.options.video.quality) {
            this.qualityIndex = this.options.video.defaultQuality;
            this.quality = this.options.video.quality[this.options.video.defaultQuality];
        }
        this.tran = new i18n(this.options.lang).tran;
        this.events = new Events();
        this.user = new User(this);
        this.container = this.options.container;
        this.container.classList.add('dplayer');
        if (!this.options.danmaku) {
            this.container.classList.add('dplayer-no-danmaku');
        }
        if (this.options.danmaku && this.options.simpleDanmaku) {
            this.container.classList.add('dplayer-simple-danmaku');
        }
        if (this.options.live) {
            this.container.classList.add('dplayer-live');
        }
        if (utils.isMobile) {
            this.container.classList.add('dplayer-mobile');
        }
        this.arrow = this.container.offsetWidth <= 500;
        if (this.arrow) {
            this.container.classList.add('dplayer-arrow');
        }

        this.template = new Template({
            container: this.container,
            options: this.options,
            index: index,
            tran: this.tran,
        });
        this.adsTemplate = new AdsTemplate({
            container: this.container,
            options: this.options,
        });

        this.adsContainer = this.adsTemplate.adsContainer;
        this.video = this.template.video;
        this.gifts = this.template.gifts;

        this.bar = new Bar(this.template);
        this.adsBar = new Bar(this.adsTemplate);

        this.bezel = new Bezel(this.template.bezel);

        this.fullScreen = new FullScreen(this);

        this.controller = new Controller(this);

        this.ads = new Ads(this.options, this.adsTemplate, this, this.adsContainer);
        this.adsActive = false;
        this.autoplayAllowed = false;
        this.autoplayRequiresMuted = false;
        this.container.classList.add('dplayer-ads-inactive');

        this.adscontroller = new AdsController(this);

        this.shownPreRoll = false;

        if (this.options.danmaku) {
            if (this.options.live) {
                this.danmaku = new LiveDanmaku({
                    container: this.template.danmaku,
                    opacity: this.user.get('opacity'),
                    show: this.user.get('danmaku'),
                    callback: () => {
                        setTimeout(() => {
                            // autoplay
                            if (this.options.autoplay) {
                                this.autoplay();
                            }
                        }, 0);
                    },
                    error: (msg) => {
                        this.notice(msg);
                    },
                    borderColor: this.options.theme,
                    height: this.arrow ? 24 : 30,
                    unlimited: this.user.get('unlimited'),
                    events: this.events,
                    tran: (msg) => this.tran(msg),
                });
            } else {
                this.danmaku = new Danmaku({
                    container: this.template.danmaku,
                    opacity: this.user.get('opacity'),
                    callback: () => {
                        setTimeout(() => {
                            this.template.danmakuLoading.style.display = 'none';

                            // autoplay
                            if (this.options.autoplay) {
                                this.autoplay();
                            }
                        }, 0);
                    },
                    error: (msg) => {
                        this.notice(msg);
                    },
                    apiBackend: this.options.apiBackend,
                    borderColor: this.options.theme,
                    height: this.arrow ? 24 : 30,
                    time: () => this.video.currentTime,
                    unlimited: this.user.get('unlimited'),
                    api: {
                        id: this.options.danmaku.id,
                        address: this.options.danmaku.api,
                        token: this.options.danmaku.token,
                        maximum: this.options.danmaku.maximum,
                        addition: this.options.danmaku.addition,
                        user: this.options.danmaku.user,
                    },
                    events: this.events,
                    tran: (msg) => this.tran(msg),
                });
            }
            this.comment = new Comment(this);
        }

        this.setting = new Setting(this);

        document.addEventListener('click', () => {
            this.focus = false;
        }, true);
        this.container.addEventListener('click', () => {
            this.focus = true;
        }, true);

        this.paused = true;

        this.timer = new Timer(this);

        this.hotkey = new HotKey(this);

        this.contextmenu = new ContextMenu(this);

        this.initVideo(this.video, this.quality && this.quality.type || this.options.video.type);

        this.infoPanel = new InfoPanel(this);

        if (!this.danmaku && this.options.autoplay) {
            if (this.type === 'hls') {
                this.video.addEventListener('loadedmetadata', () => {
                    this.autoplay();
                });
            } else {
                this.autoplay();
            }
        }

        index++;
        instances.push(this);
    }

    /**
    * Seek video
    */
    seek (time) {
        time = Math.max(time, 0);
        if (this.video.duration) {
            time = Math.min(time, this.video.duration);
        }
        if (this.video.currentTime < time) {
            this.notice(`${this.tran('FF')} ${(time - this.video.currentTime).toFixed(0)} ${this.tran('s')}`);
        }
        else if (this.video.currentTime > time) {
            this.notice(`${this.tran('REW')} ${(this.video.currentTime - time).toFixed(0)} ${this.tran('s')}`);
        }

        this.video.currentTime = time;

        if (this.danmaku) {
            this.danmaku.seek();
        }

        this.bar.set('played', time / this.video.duration, 'width');
        this.template.ptime.innerHTML = utils.secondToTime(time);
    }

    /**
     * kicking ads
     */
    runAds (adsTagURL) {
        if (!this.options.ads.enabled || !this.ads.canRun()) {
            return;
        }
        this.ads.reset();
        this.ads.initialUserAction();
        this.ads.requestAds(adsTagURL, this.autoplayAllowed, this.autoplayRequiresMuted);
    }

    /**
     * Auto play video - None user triggered interaction
     */
    autoplay () {
        const volume = this.user.get('volume');
        // check auto play with sound first
        if (this.options.nativeMute || this.user.get('muted') || volume === 0) {
            this.checkAutoplayWithoutSound();
        } else {
            this.video.volume = volume;
            this.video.muted = false;
            const playedPromise = Promise.resolve(this.video.play());
            playedPromise.then(() => {
                this.autoplayWithSoundSuccess();
            }).catch(() => {
                this.checkAutoplayWithoutSound();
            });
        }
    }

    autoplayWithSoundSuccess () {
        this.autoplayAllowed = true;
        this.autoplayRequiresMuted = false;
        this.unmute();
        this.play();
    }

    checkAutoplayWithoutSound () {
        this.video.volume = 0;
        this.video.muted = true;
        const playedPromise = Promise.resolve(this.video.play());
        playedPromise.then(() => {
            this.onMutedAutoplaySuccess();
        }).catch(() => {
            this.onMutedAutoplayFailed();
        });
    }

    onMutedAutoplaySuccess () {
        this.autoplayAllowed = true;
        this.autoplayRequiresMuted = true;
        this.mute();
        this.play();
    }

    onMutedAutoplayFailed () {
        this.autoplayAllowed = false;
        this.autoplayRequiresMuted = true;
        this.mute();
        this.pause();
    }

    /**
     * Play video - User triggered interaction
     */
    play () {
        this.paused = false;
        if (this.video.paused) {
            this.bezel.switch(Icons.play);
        }

        this.template.playButton.innerHTML = Icons.pause;

        if (this.options.ads.enabled && this.options.ads.preRoll && !this.shownPreRoll && this.ads.canRun()) {
            this.runAds(this.options.ads.ima.prerollAdsTagURL);
            this.shownPreRoll = true;
        } else {
            const playedPromise = Promise.resolve(this.video.play());
            playedPromise.catch(() => {
                this.pause();
            }).then(() => {
            });
        }

        this.timer.enable('loading');
        this.container.classList.remove('dplayer-paused');
        this.container.classList.add('dplayer-playing');
        if (this.danmaku) {
            this.danmaku.play();
        }
        if (this.options.mutex) {
            for (let i = 0; i < instances.length; i++) {
                if (this !== instances[i]) {
                    instances[i].pause();
                }
            }
        }
    }

    /**
     * Pause video
     */
    pause () {
        this.paused = true;
        this.container.classList.remove('dplayer-loading');

        if (!this.video.paused) {
            this.bezel.switch(Icons.pause);
        }

        this.template.playButton.innerHTML = Icons.play;
        this.video.pause();
        this.timer.disable('loading');
        this.container.classList.remove('dplayer-playing');
        this.container.classList.add('dplayer-paused');
        if (this.danmaku) {
            this.danmaku.pause();
        }
    }

    /**
     * Ads about to play, pause video to play ads
     */
    pauseForAd () {
        // set playing
        this.adsActive = true;
        this.adsTemplate.playButton.innerHTML = Icons.pause;

        // pause video
        this.pause();
        this.timer.disable('loading');
        this.container.classList.remove('dplayer-paused');
        this.container.classList.add('dplayer-playing');
        if (this.danmaku) {
            this.danmaku.pause();
        }
        this.container.classList.add('dplayer-ads-active');
        this.container.classList.remove('dplayer-ads-inactive');
    }

    /**
     * Ads finished playiing, resume video
     */
    resumeAfterAd () {
        this.adsActive = false;
        this.container.classList.add('dplayer-ads-inactive');
        this.container.classList.remove('dplayer-ads-active');

        this.play();
    }

    switchVolumeIcon () {
        if (this.volume() >= 0.95) {
            this.template.volumeIcon.innerHTML = Icons.volumeUp;
            this.adsTemplate.volumeIcon.innerHTML = Icons.volumeUp;
        }
        else if (this.volume() > 0) {
            this.template.volumeIcon.innerHTML = Icons.volumeDown;
            this.adsTemplate.volumeIcon.innerHTML = Icons.volumeDown;
        }
        else {
            this.template.volumeIcon.innerHTML = Icons.volumeOff;
            this.adsTemplate.volumeIcon.innerHTML = Icons.volumeOff;
        }
    }

    /**
     * mute video
     */
    mute () {
        this.video.muted = true;
        // TODO(yumin): add nostore option.
        this.user.set('muted', true);
        this.template.volumeIcon.innerHTML = Icons.volumeOff;
        this.adsTemplate.volumeIcon.innerHTML = Icons.volumeOff;
        this.bar.set('volume', 0, 'width');
        this.adsBar.set('volume', 0, 'width');
        this.ads.setVolume(0);
    }

    /**
     * unmute video
     */
    unmute () {
        this.video.muted = false;
        // TODO(yumin): add nostore option.
        this.user.set('muted', false);
        this.switchVolumeIcon();
        const v = this.volume();
        if (v > 0) {
            this.bar.set('volume', v, 'width');
            this.adsBar.set('volume', v, 'width');
            this.volume(v, false, true);
            this.ads.setVolume(v);
        } else {
            this.bar.set('volume', 0.5, 'width');
            this.adsBar.set('volume', 0.5, 'width');
            this.volume(0.5, false, true);
            this.ads.setVolume(0.5);
        }
    }

    /**
     * Set volume
     */
    volume (percentage, nostorage, nonotice) {
        percentage = parseFloat(percentage);
        if (!isNaN(percentage)) {
            percentage = Math.max(percentage, 0);
            percentage = Math.min(percentage, 1);
            this.bar.set('volume', percentage, 'width');
            this.adsBar.set('volume', percentage, 'width');
            const formatPercentage = `${(percentage * 100).toFixed(0)}%`;
            this.template.volumeBarWrapWrap.dataset.balloon = formatPercentage;
            this.adsTemplate.volumeBarWrapWrap.dataset.balloon = formatPercentage;
            if (!nostorage) {
                this.user.set('volume', percentage);
            }
            if (!nonotice) {
                this.notice(`${this.tran('Volume')} ${(percentage * 100).toFixed(0)}%`);
            }

            // XXX(yumin): need to unmute before setting volume.
            if (this.video.muted && percentage > 0) {
                this.video.muted = false;
                if (!nostorage) {
                    this.user.set('muted', false);
                }
            }

            // set volume
            this.video.volume = percentage;
            this.ads.setVolume(percentage);
            this.switchVolumeIcon();
        }
        return this.video.volume;
    }

    /**
     * Toggle between play and pause
     */
    toggle () {
        if (this.video.paused) {
            this.play();
        }
        else {
            this.pause();
        }
    }

    /**
     * attach event
     */
    on (name, callback) {
        this.events.on(name, callback);
    }

    /**
     * Switch to a new video
     *
     * @param {Object} video - new video info
     * @param {Object} danmaku - new danmaku info
     */
    switchVideo (video, danmakuAPI) {
        this.pause();
        this.video.poster = video.pic ? video.pic : '';
        this.video.src = video.url;
        this.initMSE(this.video, video.type || 'auto');
        if (danmakuAPI) {
            this.template.danmakuLoading.style.display = 'block';
            this.bar.set('played', 0, 'width');
            this.bar.set('loaded', 0, 'width');
            this.template.ptime.innerHTML = '00:00';
            this.template.danmaku.innerHTML = '';
            if (this.danmaku) {
                this.danmaku.reload({
                    id: danmakuAPI.id,
                    address: danmakuAPI.api,
                    token: danmakuAPI.token,
                    maximum: danmakuAPI.maximum,
                    addition: danmakuAPI.addition,
                    user: danmakuAPI.user,
                });
            }
        }
    }

    initMSE (video, type) {
        this.type = type;
        if (this.options.video.customType && this.options.video.customType[type]) {
            if (Object.prototype.toString.call(this.options.video.customType[type]) === '[object Function]') {
                this.options.video.customType[type](this.video, this);
            }
            else {
                console.error(`Illegal customType: ${type}`);
            }
        }
        else {
            if (this.type === 'auto') {
                if (/m3u8(#|\?|$)/i.exec(video.src)) {
                    this.type = 'hls';
                }
                else if (/.flv(#|\?|$)/i.exec(video.src)) {
                    this.type = 'flv';
                }
                else if (/.mpd(#|\?|$)/i.exec(video.src)) {
                    this.type = 'dash';
                }
                else {
                    this.type = 'normal';
                }
            }

            if (this.type === 'hls' && (video.canPlayType('application/x-mpegURL') || video.canPlayType('application/vnd.apple.mpegURL'))) {
                this.type = 'normal';
            }

            switch (this.type) {
            // https://github.com/video-dev/hls.js
            case 'hls':
                if (Hls) {
                    if (Hls.isSupported()) {
                        const hls = new Hls();
                        hls.loadSource(video.src);
                        hls.attachMedia(video);
                    }
                    else {
                        this.notice('Error: Hls is not supported.');
                    }
                }
                else {
                    this.notice('Error: Can\'t find Hls.');
                }
                break;

            // hls instance is held by parent(p = portable), support quality switching.
            // user need to pass in hls levels in options.
            case 'hls-p':
                if (this.options.video.hls) {
                    const hls_instance = this.options.video.hls;
                    hls_instance.attachMedia(this.video);
                } else {
                    this.notice('Error: hls-p mode requires video.hls to be the hls instance.');
                }
                break;

            // https://github.com/Bilibili/flv.js
            case 'flv':
                if (flvjs && flvjs.isSupported()) {
                    if (flvjs.isSupported()) {
                        const flvPlayer = flvjs.createPlayer({
                            type: 'flv',
                            url: video.src
                        });
                        flvPlayer.attachMediaElement(video);
                        flvPlayer.load();
                    }
                    else {
                        this.notice('Error: flvjs is not supported.');
                    }
                }
                else {
                    this.notice('Error: Can\'t find flvjs.');
                }
                break;

            // https://github.com/Dash-Industry-Forum/dash.js
            case 'dash':
                if (dashjs) {
                    dashjs.MediaPlayer().create().initialize(video, video.src, false);
                }
                else {
                    this.notice('Error: Can\'t find dashjs.');
                }
                break;

            // https://github.com/webtorrent/webtorrent
            case 'webtorrent':
                if (WebTorrent) {
                    if (WebTorrent.WEBRTC_SUPPORT) {
                        this.container.classList.add('dplayer-loading');
                        const client = new WebTorrent();
                        const torrentId = video.src;
                        client.add(torrentId, (torrent) => {
                            const file = torrent.files.find((file) => file.name.endsWith('.mp4'));
                            file.renderTo(this.video, {
                                autoplay: this.options.autoplay
                            }, () => {
                                this.container.classList.remove('dplayer-loading');
                            });
                        });
                    }
                    else {
                        this.notice('Error: Webtorrent is not supported.');
                    }
                }
                else {
                    this.notice('Error: Can\'t find Webtorrent.');
                }
                break;
            }
        }
    }

    initVideo (video, type) {
        this.initMSE(video, type);

        /**
         * video events
         */
        // show video time: the metadata has loaded or changed
        this.on('durationchange', () => {
            // compatibility: Android browsers will output 1 or Infinity at first
            if (video.duration !== 1 && video.duration !== Infinity) {
                this.template.dtime.innerHTML = utils.secondToTime(video.duration);
            }
        });

        // show video loaded bar: to inform interested parties of progress downloading the media
        this.on('progress', () => {
            const percentage = video.buffered.length ? video.buffered.end(video.buffered.length - 1) / video.duration : 0;
            this.bar.set('loaded', percentage, 'width');
        });

        // video download error: an error occurs
        this.on('error', () => {
            if (!this.video.error) {
                // Not a video load error, may be poster load failed, see #307
                return;
            }
            this.tran && this.notice && this.type !== 'webtorrent' & this.notice(this.tran('Video load failed'), -1);
        });

        // video end
        this.on('ended', () => {
            this.bar.set('played', 1, 'width');
            if (!this.setting.loop) {
                this.pause();
            }
            else {
                this.seek(0);
                this.play();
            }
            if (this.danmaku) {
                this.danmaku.danIndex = 0;
            }
        });

        this.on('play', () => {
            if (this.paused) {
                this.play();
            }
        });

        this.on('pause', () => {
            if (!this.paused) {
                this.pause();
            }
        });

        this.on('timeupdate', () => {
            this.bar.set('played', this.video.currentTime / this.video.duration, 'width');
            const currentTime = utils.secondToTime(this.video.currentTime);
            if (this.template.ptime.innerHTML !== currentTime) {
                this.template.ptime.innerHTML = currentTime;
            }
        });

        for (let i = 0; i < this.events.videoEvents.length; i++) {
            video.addEventListener(this.events.videoEvents[i], () => {
                this.events.trigger(this.events.videoEvents[i]);
            });
        }

        if (this.options.nativeMute) {
            this.bar.set('volume', 0, 'width');
            this.template.volumeIcon.innerHTML = Icons.volumeOff;
            this.video.muted = true;
            this.notice('muted');
        } else {
            this.volume(this.user.get('volume'), true, true);
            if (this.user.get('muted') === true) {
                this.video.muted = true;
                this.template.volumeIcon.innerHTML = Icons.volumeOff;
                this.bar.set('volume', 0, 'width');
            }
        }
        if (this.options.subtitle) {
            this.subtitle = new Subtitle(this.template.subtitle, this.video, this.options.subtitle, this.events);
            if (!this.user.get('subtitle')) {
                this.subtitle.hide();
            }
        }
    }

    switchQuality (index) {
        index = typeof index === 'string' ? parseInt(index) : index;
        if (this.qualityIndex === index || this.switchingQuality) {
            return;
        }
        else {
            this.qualityIndex = index;
        }
        this.switchingQuality = true;
        const oldQuality = this.quality;
        this.quality = this.options.video.quality[index];
        this.template.qualityButton.innerHTML = this.quality.name;

        // hls-p quality switching use hls.js's quality switching.
        // the dirty magic going on here is that.. hls levels
        // are stored in url in string, as hlsjs convention, -1 = auto.
        if (this.options.video.type === 'hls-p') {
            const hls = this.options.video.hls;
            const HlsType = this.options.video.hlsType;
            this.notice(`${this.tran('Switching to')} ${this.quality.name} ${this.tran('quality')}`, -1);
            this.events.trigger('quality_start', this.quality);
            const switchSuccCb = (event, data) => {
                this.notice(`${this.tran('Switched to')} ${this.quality.name} ${this.tran('quality')}`);
                this.switchingQuality = false;
                this.events.trigger('quality_end');
            };
            const switchFailedCb = (event, data) => {
                this.notice(`${this.tran('Failed to switched to')} ${this.quality.name} ${this.tran('quality')}`);
                this.switchingQuality = false;
                this.events.trigger('quality_end');
                // reset to previous.
                this.quality = oldQuality;
                this.template.qualityButton.innerHTML = oldQuality.name;
            };
            const timeoutCb = () => {
                hls.off(HlsType.Events.LEVEL_SWITCHED, switchSuccCb);
                hls.off(HlsType.ErrorDetails.LEVEL_SWITCH_ERROR, switchFailedCb);
            };
            // start switching.
            const targetLevel = parseInt(this.quality.url);
            if (hls.currentLevel === targetLevel) {
                switchSuccCb(null, null);
            } else if (targetLevel === -1) {
                // we assume switch to it auto always success to avoid
                // a cornor case: switch to same level won't fire LEVEL_SWITCHED event.
                hls.nextLevel = targetLevel;
                switchSuccCb(null, null);
            } else {
                hls.once(HlsType.Events.LEVEL_SWITCHED, switchSuccCb);
                hls.once(HlsType.ErrorDetails.LEVEL_SWITCH_ERROR, switchFailedCb);
                // release resource after 2 minutes.
                setTimeout(timeoutCb, 120 * 1000);
                hls.nextLevel = targetLevel;
            }
            return;
        }

        const paused = this.video.paused;
        this.video.pause();
        const videoHTML = tplVideo({
            current: false,
            pic: null,
            screenshot: this.options.screenshot,
            preload: 'auto',
            url: this.quality.url,
            subtitle: this.options.subtitle,
        });
        const videoEle = new DOMParser().parseFromString(videoHTML, 'text/html').body.firstChild;
        this.template.videoWrap.insertBefore(videoEle, this.template.videoWrap.getElementsByTagName('div')[0]);
        this.prevVideo = this.video;
        this.video = videoEle;
        this.initVideo(this.video, this.quality.type || this.options.video.type);
        this.seek(this.prevVideo.currentTime);
        this.notice(`${this.tran('Switching to')} ${this.quality.name} ${this.tran('quality')}`, -1);
        this.events.trigger('quality_start', this.quality);

        this.on('canplay', () => {
            if (this.prevVideo) {
                if (this.video.currentTime !== this.prevVideo.currentTime) {
                    this.seek(this.prevVideo.currentTime);
                    return;
                }
                this.template.videoWrap.removeChild(this.prevVideo);
                this.video.classList.add('dplayer-video-current');
                if (!paused) {
                    this.video.play();
                }
                this.prevVideo = null;
                this.notice(`${this.tran('Switched to')} ${this.quality.name} ${this.tran('quality')}`);
                this.switchingQuality = false;

                this.events.trigger('quality_end');
            }
        });
    }

    notice (text, time = 2000, opacity = 0.8) {
        this.template.notice.innerHTML = text;
        this.template.notice.style.opacity = opacity;
        if (this.noticeTime) {
            clearTimeout(this.noticeTime);
        }
        this.events.trigger('notice_show', text);
        if (time > 0) {
            this.noticeTime = setTimeout(() => {
                this.template.notice.style.opacity = 0;
                this.events.trigger('notice_hide');
            }, time);
        }
    }

    resize () {
        if (this.danmaku) {
            this.danmaku.resize();
        }
        if (this.controller.thumbnails) {
            this.controller.thumbnails.resize(160, this.video.videoHeight / this.video.videoWidth * 160, this.template.barWrap.offsetWidth);
        }

        if (this.adsActive) {
            const isFullScreen = this.fullScreen.isFullScreen('browser');
            const w = isFullScreen ? this.fullScreen.fullscreenWidth : this.video.clientWidth;
            const h = isFullScreen ? this.fullScreen.fullscreenHeight : this.video.clientHeight;
            this.ads.resize(w, h, isFullScreen);
        }

        this.events.trigger('resize');
    }

    speed (rate) {
        this.video.playbackRate = rate;
    }

    destroy () {
        instances.splice(instances.indexOf(this), 1);
        this.pause();
        this.controller.destroy();
        this.timer.destroy();
        this.video.src = '';
        this.container.innerHTML = '';
        this.events.trigger('destroy');
    }

    static get version () {
        /* global DPLAYER_VERSION */
        return DPLAYER_VERSION;
    }
}

export default DPlayer;
