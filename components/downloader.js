const axios = require('axios');
const cheerio = require('cheerio');

class Downloader {
    constructor() {
        this.request = axios.create();
        this.cookies = {};
        this.init();
    }

    init() {
        this.request.interceptors.response.use(this.responseInterceptor.bind(this));
    }

    responseInterceptor(response) {
        if("set-cookie" in response.headers && Array.isArray(response.headers['set-cookie'])) {
            response.headers['set-cookie'].forEach(cookie => {
                cookie = cookie.split(';');
                if(cookie.length > 0 && cookie[0].includes('=')) {
                    const cookieSplit = cookie[0].split('=');
                    this.cookies[cookieSplit[0]] = cookie[0];
                }
            })
        }

        return response;
    }

    async getDownloadParams(videourl) {
        const form = {};

        const { status, data } = await this.request.get("https://musicaldown.com/en");
        
        if(status !== 200) throw new Error(`getDownloadParams(): Bad Request (StatusCode: ${status})`);

        /* Extract form params */
        const $ = cheerio.load(data);
        const inputs = $('form#submit-form input');
        
        if(!inputs || !inputs.length) {
            throw new Error("Can't get form params!");
        }
        
        inputs.each((index, input) => {
            form[$(input).attr('name')] = ($(input).attr('id') == "link_url") 
                ? videourl 
                : $(input).val();
        })

        return form;
    }

    async getDownloadLink(form) {
        
        const { status, data } = await this.request.postForm('https://musicaldown.com/download', form, {
            headers: { 
                'Content-Type': 'application/x-www-form-urlencoded',
                'cookie': Object.values(this.cookies).join('; '),
                'origin': 'https://musicaldown.com',
                'referer': 'https://musicaldown.com/en' 
            }
        });

        if(status !== 200) throw new Error(`getDownloadLink(): Bad Request (StatusCode: ${status})`);

        const $ = cheerio.load(data);
        const links = $('[href*="tiktokcdn.com"]');

        if(!links.length) {
            throw new Error("Download links not found in response");
        }

        return $(links[0]).attr('href');
    }

    
    async downloadFile(file_url) {
        const { status, data } = await axios({method: 'GET', url: file_url, responseType: 'arraybuffer'});
        if(status !== 200) throw new Error(`downloadFile(): Bad Request (StatusCode: ${status})`);
        return Buffer.from(data, 'binary');
    }
    
    async download(video_link) {
        /* Get page form params */
        const form = await this.getDownloadParams(video_link).catch(error => {
            throw new Error(`Error while get download params: ${error.meessage}`);
        });
        /* Get download url */
        const link = await this.getDownloadLink(form).catch(error => {
            throw new Error(`Error while get file download url: ${error.meessage}`);
        });

        return link;
    }
}

module.exports = Downloader;