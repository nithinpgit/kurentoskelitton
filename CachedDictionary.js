class CachedDictionary {
    constructor(name, key)
    {
        this.name = name;
        this.key = key;
        this.objects = {}
    }

    getItem(key, callback)
    {
        if(callback)
            callback(null, this.objects[key]);
    }

    setItem(key, value, callback)
    {
        this.objects[key] = value;

        if(callback)
            callback();
    }

    removeItem(key, callback)
    {
        delete this.objects[key];

        if(callback)
            callback();
    }
}

module.exports = CachedDictionary;