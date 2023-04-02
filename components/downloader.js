const axios = require('axios');
const cheerio = require('cheerio');
const moment = require('moment');

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
    
    /* Download Tiktok Video */
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

    /* Download Instagram Reel's Video */
    async downloadInstagramReels(url) {
        const regex = /https?:\/\/(?:www\.)?instagram\.com\/(?:reel|p)\/([a-zA-Z0-9_-]+)\//;
        const match = url.match(regex);
        if (!match) throw new Error(`Invalid url format or video id not found`);


        const response = await axios.request({
            method: "get",
            url: `https://www.instagram.com/graphql/query/?query_hash=b3055c01b4b222b8a47dc12b090e4e64&variables={"shortcode":"${match[1]}"}`,
            headers: {
                "referer": "https://www.instagram.com/reel/CppS4m0Dlqj/?igshid=YmMyMTA2M2Y%3D",
                "sec-ch-prefers-color-scheme": "light",
                "sec-ch-ua": `"Google Chrome";v="111", "Not(A:Brand";v="8", "Chromium";v="111"`,
                "sec-ch-ua-mobile": "?0",
                "sec-ch-ua-platform": "Windows",
                "sec-fetch-dest": "empty",
                "sec-fetch-mode": `cors`,
                "sec-fetch-site": `same-origin`,
                "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36",
                "viewport-width": `1920`,
                "x-asbd-id": `198387`,
                "x-csrftoken": "RmqLJHBgtAmvo0tBtdMc9nXuZmQ5CZN2",
                "x-ig-app-id": "936619743392459",
                "x-ig-www-claim": "hmac.AR1890V-k65BosLO-m78Ycb3k9wnfL4XZ0tD2QALsEbvUoHb",
                "x-requested-with": "XMLHttpRequest",
                "cookie": 'cookie: ig_did=751EA156-7FD5-45CE-8025-1EAAB5C37449; ig_nrcb=1; mid=ZCmvUAALAAGZrTkiJYmwjNPek0bX; datr=UK8pZGdZIsY_BYeg2eBok6Xb; csrftoken=RmqLJHBgtAmvo0tBtdMc9nXuZmQ5CZN2; ds_user_id=31222586725; sessionid=31222586725%3AEqMxR2rRHClHpI%3A3%3AAYc1w1le42hTL-nnQaukdexWYnu41FuoWq_VaGck-g; rur="RVA,31222586725,1711991197:01f7f7efab2b9537749d398ec809dbb69a77427234e31a5f2533a4912d7c642ed5fc3ce0"'
            }
        })

        // const response = await axios(`https://www.instagram.com/graphql/query/?query_hash=b3055c01b4b222b8a47dc12b090e4e64&variables={"shortcode":"${match[1]}"}`});
        
        if(response.status !== 200) throw new Error(`downloadInstagramReels(${url}): Bad Request (StatusCode: ${response.status})`);

        if(typeof response.data !== "object") throw new Error(`Response is not JSON. (Video: ${url})`);
        
        const data = ("data" in response.data && "shortcode_media" in response.data.data) ? response.data.data.shortcode_media : null;
        if(!data) throw new Error(`Can't get shortcode_media from response.data.data`);

        const caption = ("edge_media_to_caption" in data && "edges" in data.edge_media_to_caption && data.edge_media_to_caption.edges.length)
            ? data.edge_media_to_caption.edges[0].node.text.replace(/#[a-zA-Z0-9_]+/g, "")
            : null;

        const published = ("edge_media_to_caption" in data && "edges" in data.edge_media_to_caption && data.edge_media_to_caption.edges.length)
            ? moment(parseInt(data.edge_media_to_caption.edges[0].node.created_at) * 1000).locale('uk').fromNow()
            : null;
        
        const likes = ("edge_media_preview_like" in data && "count" in data.edge_media_preview_like)
            ? data.edge_media_preview_like.count
            : null;

        const owner = {
            "url": ("owner" in data && "username" in data.owner)
                ? "https://instagram.com/"+data.owner.username
                : null,
            "name": ("owner" in data && "full_name" in data.owner)
                ? data.owner.full_name
                : null
        }

        const video = {url: data.video_url, preview: data.display_url, likes, caption, published, owner};
        return video;
    }
}

module.exports = Downloader;

// new Downloader().downloadInstagramReels("https://www.instagram.com/reel/CppS4m0Dlqj/?igshid=YmMyMTA2M2Y=");