import utils from './utils';
import Thumbnails from './thumbnails';
import Icons from './icons';

class AdsController {
    constructor (player) {
        this.player = player;
        this.initPlayButton();
        this.initFullButton();
        this.initVolumeButton();
        this.initTheater();
    }

    initPlayButton () {
        this.player.adsTemplate.playButton.addEventListener('click', () => {
            this.player.ads.toggle();
        });
    }

    initFullButton () {
        this.player.adsTemplate.browserFullButton.addEventListener('click', () => {
            this.player.fullScreen.toggle('browser');
        });
    }

    initVolumeButton () {
        const vWidth = 35;

        const volumeMove = (event) => {
            const e = event || window.event;
            const percentage = ((e.clientX || e.changedTouches[0].clientX) - utils.getBoundingClientRectViewLeft(this.player.adsTemplate.volumeBarWrap) - 5.5) / vWidth;
            this.player.volume(percentage);
        };
        const volumeUp = () => {
            document.removeEventListener(utils.nameMap.dragEnd, volumeUp);
            document.removeEventListener(utils.nameMap.dragMove, volumeMove);
            this.player.adsTemplate.volumeButton.classList.remove('dplayer-volume-active');
        };

        this.player.adsTemplate.volumeBarWrapWrap.addEventListener('click', (event) => {
            const e = event || window.event;
            const percentage = ((e.clientX || e.changedTouches[0].clientX) - utils.getBoundingClientRectViewLeft(this.player.adsTemplate.volumeBarWrap) - 5.5) / vWidth;
            this.player.volume(percentage);
        });
        this.player.adsTemplate.volumeBarWrapWrap.addEventListener(utils.nameMap.dragStart, () => {
            document.addEventListener(utils.nameMap.dragMove, volumeMove);
            document.addEventListener(utils.nameMap.dragEnd, volumeUp);
            this.player.adsTemplate.volumeButton.classList.add('dplayer-volume-active');
        });
        this.player.adsTemplate.volumeButtonIcon.addEventListener('click', () => {
            if (this.player.video.muted) {
                this.player.unmute();
            } else {
                this.player.mute();
            }
        });
    }

    initTheater () {
        if (!this.player.options.theater) {
            return;
        }
        this.player.adsTemplate.theaterToggle.addEventListener('click', () => {
            this.player.events.trigger('theater_toggle');
        });
    }
}

export default AdsController;
