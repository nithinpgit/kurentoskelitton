/**
 * SETTINGS.JS
 */
'use strict';

var videoElement = document.getElementById('videosettings');
var audioInputSelect = document.querySelector('select#audioSource');
var audioOutputSelect = document.querySelector('select#audioOutput');
var videoSelect = document.querySelector('select#videoSource');
var selectors = [audioInputSelect, audioOutputSelect, videoSelect];
var video_enable = '1';

function gotDevices(deviceInfos) {
    // Handles being called several times to update labels. Preserve values.
    var values = selectors.map(function (select) {
        return select.value;
    });
    selectors.forEach(function (select) {
        while (select.firstChild) {
            select.removeChild(select.firstChild);
        }
    });
    for (var i = 0; i !== deviceInfos.length; ++i) {
        var deviceInfo = deviceInfos[i];
        var option = document.createElement('option');
        if (deviceInfo.kind === 'audioinput') {
            var audioLabal = deviceInfo.label;
            option.value = deviceInfo.deviceId;
            if (audioLabal.length > 22) {
                audioLabal = audioLabal.substring(0, 22) + '...';
            }
            option.text = audioLabal ||
                'microphone ' + (audioInputSelect.length + 1);
            audioInputSelect.appendChild(option);
            audioPresent = true;
        } else if (deviceInfo.kind === 'audiooutput') {
            option.text = deviceInfo.label || 'speaker ' +
                (audioOutputSelect.length + 1);
            option.value = deviceInfo.deviceId;
            audioOutputSelect.appendChild(option);
        } else if (deviceInfo.kind === 'videoinput') {
            var infolabal = deviceInfo.label;
            if (infolabal) {
                if (infolabal.length > 4) {
                    videoPresent = true;
                }
                if (infolabal.length > 22) {
                    infolabal = infolabal.substring(0, 22) + '...';
                }
            }

            option.text = infolabal || 'camera ' + (videoSelect.length + 1);
            option.value = deviceInfo.deviceId;
            videoSelect.appendChild(option);
        } else {
            console.log('Some other kind of source/device: ', deviceInfo);
        }
    }
    selectors.forEach(function (select, selectorIndex) {
        if (Array.prototype.slice.call(select.childNodes).some(function (n) {
                return n.value === values[selectorIndex];
            })) {
            select.value = values[selectorIndex];
        }
    });

    if (videoPresent) {
        $('.video-bad').addClass('hide');
        $('.video-ok').removeClass('hide');
        $('.cam-name').html($('#videoSource option:selected').text());
        camAvailable = true;
    }
    if (audioPresent) {
        $('.audio-bad').addClass('hide');
        $('.audio-ok').removeClass('hide');
        $('.mic-name').html($('#audioSource option:selected').text());
        micAvailable = true;
    }
}

navigator.mediaDevices.enumerateDevices().then(gotDevices).catch(handleError);

// Attach audio output device to video element using device/sink ID.
function attachSinkId(element, sinkId) {
    if (typeof element.sinkId !== 'undefined') {
        element.setSinkId(sinkId)
            .then(function () {
                console.log('Success, audio output device attached: ' + sinkId);
            })
            .catch(function (error) {
                var errorMessage = error;
                if (error.name === 'SecurityError') {
                    errorMessage = 'You need to use HTTPS for selecting audio output ' +
                        'device: ' + error;
                }
                console.error(errorMessage);
                // Jump back to first output device in the list as it's the default.
                audioOutputSelect.selectedIndex = 0;
            });
    } else {
        console.warn('Browser does not support output device selection.');
    }
}

function changeAudioDestination() {
    var audioDestination = audioOutputSelect.value;
    attachSinkId(videoElement, audioDestination);
}
var streamHere;

function gotStream(stream) {
    window.stream = stream; // make stream available to console
    videoElement.srcObject = stream;
    videoElement.play();
    // Refresh button list in case labels have become available
    return navigator.mediaDevices.enumerateDevices();
}

function disposeCam() {
    if (window.stream) {
        window.stream.getTracks().forEach(function (track) {
            track.stop();
        });
    }
}

function start() {
    if (window.stream) {
        window.stream.getTracks().forEach(function (track) {
            track.stop();
        });
    }
    var audioSource = audioInputSelect.value;
    var videoSource = videoSelect.value;

    if (video_enable == '1') {
        var constraints = {
            audio: {
                deviceId: audioSource ? {
                    exact: audioSource
                } : undefined
            },
            video: {
                deviceId: videoSource ? {
                    exact: videoSource
                } : undefined
            }
        };
    } else {
        var constraints = {
            audio: {
                deviceId: audioSource ? {
                    exact: audioSource
                } : undefined
            },
            video: false
        };
    }

    navigator.mediaDevices.getUserMedia(constraints).
    then(gotStream).then(gotDevices).catch(handleError);
    if (audioSource) {
        selectedMicrophone = audioSource;
    }
    if (videoSource) {
        selectedCamera = videoSource;
    }
}

audioInputSelect.onchange = start;
audioOutputSelect.onchange = changeAudioDestination;
videoSelect.onchange = start;

setTimeout(start, 1000);

function handleError(error) {
    console.log('navigator.getUserMedia error: ', error);
}
var tmeout = 0;

function checkSpeaker() {
    var snd = document.getElementById("audio");
    if (document.getElementById('checkspeaker').innerHTML == 'Check Speaker') {
        snd.play();
        if (tmeout) {
            clearTimeout(tmeout);
        }
        tmeout = setTimeout(stopPlay, 6000, snd);
        $(".check-speaker").html('Stop Speaker Check');
        $(".check-speaker").addClass("check-green");

    } else {
        stopPlay(snd);

    }
}

function stopPlay(snd) {
    snd.pause();
    snd.currentTime = 0;
    document.getElementById('checkspeaker').innerHTML = 'Check Speaker';
}

function micLevelIndicator(stream) {
    var audioContext = new AudioContext; //or webkitAudioContext
    var source = audioContext.createMediaStreamSource(stream);
    var analyser = audioContext.createAnalyser();
    var scriptNode = audioContext.createScriptProcessor(2048, 1, 1);

    var volume = audioContext.createGain();
    source.connect(volume);
    volume.gain.value = 0; //turn off the speakers
    volume.connect(audioContext.destination);


    analyser.smoothingTimeConstant = 0.3;
    analyser.fftSize = 1024;
    analyser.minDecibels = -90;
    analyser.maxDecibels = -10;

    source.connect(analyser);
    analyser.connect(scriptNode);
    scriptNode.connect(audioContext.destination);

    scriptNode.onaudioprocess = function () {
        var array = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(array);
        var values = 0;

        var length = array.length;
        for (var i = 0; i < length; i++) {
            values += array[i];
        }

        var average = (values / length);
        $(".sound_track ul li").each(function () {
            var ths = $(this),
                level = ths.data("level");
            ths.children().css("background", "");
            if (level <= average) {
                if (average <= 30) {
                    ths.children().css("background", "green");
                } else if (average > 30 && average <= 60) {
                    ths.children().css("background", "orange");
                } else {
                    ths.children().css("background", "red");
                }

            }
        });
    }

}
