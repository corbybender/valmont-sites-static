Type.registerNamespace("Telerik.Sitefinity.Services.Search.Web.UI.Public");

Telerik.Sitefinity.Services.Search.Web.UI.Public.SearchBox = function (element) {
    Telerik.Sitefinity.Services.Search.Web.UI.Public.SearchBox.initializeBase(this, [element]);

    this._searchTextBox = null;
    this._searchButton = null;
    this._resultsUrl = null;
    this._indexCatalogue = null;
    this._suggestionFields = null;
    this._suggestionsRoute = null;
    this._disableSuggestions = null;
    this._minSuggestLength = null;
    this._language = null;
    this._siteId = null;

    this._keyPressDelegate = null;
    this._keyUpDelegate = null;
    this._clickDelegate = null;
    this._suggestionsSuccessDelegate = null;
    this._suggestionSelectedDelegate = null;
}

Telerik.Sitefinity.Services.Search.Web.UI.Public.SearchBox.prototype = {

    initialize: function () {
        Telerik.Sitefinity.Services.Search.Web.UI.Public.SearchBox.callBaseMethod(this, "initialize");

        if (this._searchTextBox) {
            this._keyPressDelegate = Function.createDelegate(this, this._keyPressHandler);
            $addHandler(this._searchTextBox, "keypress", this._keyPressDelegate);
            this._keyUpDelegate = Function.createDelegate(this, this._keyUpHandler);
            $addHandler(this._searchTextBox, "keyup", this._keyUpDelegate);
        }

        if (this._searchButton) {
            this._clickDelegate = Function.createDelegate(this, this._clickHandler);
            $addHandler(this._searchButton, "click", this._clickDelegate);
        }

        if (this._disableSuggestions != null && !this._disableSuggestions) {
            this._suggestionsSuccessDelegate = Function.createDelegate(this, this._suggestionsSuccess);
            this._suggestionSelectedDelegate = Function.createDelegate(this, this._suggestionSelected);

            var that = this;
            try{
                $("#" + this._searchTextBox.id).kendoAutoComplete({
                    dataSource:
                        {
                            serverFiltering: true,
                            data: []
                        },
                    select: function (e) {
                        $("#" + that._searchTextBox.id).val(this.dataItem(e.item.index()));
                        that.navigateToResults(e);
                    },
                    minLength: this._minSuggestLength
                });
            } catch (e) {
                // Fixes jQuery bug, causing IE7 to throw error "script3 member not found".
                // The try/catch can be removed when the bug is fixed.
            }
        }
    },

    dispose: function () {
        if (this._searchTextBox && this._keyPressDelegate) {
            if (this._searchTextBox) {
                $removeHandler(this._searchTextBox, "keypress", this._keyPressDelegate);
                $removeHandler(this._searchTextBox, "keyup", this._keyUpDelegate);
            }
            delete this._keyPressDelegate;
        }
        if (this._searchButton && this._clickDelegate) {
            if (this._searchButton) {
                $removeHandler(this._searchButton, "click", this._clickDelegate);
            }
            delete this._clickDelegate;
        }

        Telerik.Sitefinity.Services.Search.Web.UI.Public.SearchBox.callBaseMethod(this, "dispose");
    },

    /* -------------------- Public methods ---------------- */

    navigateToResults: function (e) {
        if (!e) var e = window.event;

        if (e.stopPropagation) {
            e.stopPropagation();
        }
        else {
            e.cancelBubble = true;
        }
        if (e.preventDefault) {
            e.preventDefault();
        }
        else {
            e.returnValue = false;
        }

        if (this._searchTextBox.value && this._searchTextBox.value.trim() && this._indexCatalogue) {
            this.sendSentence();
            window.location = this.getLocation();
        }
    },

    getLocation: function () {
        var query = this._searchTextBox.value.trim();
        var separator = (this._resultsUrl.indexOf("?") == -1) ? "?" : "&";
        var indexCatalogue = String.format("{0}indexCatalogue={1}", separator, Url.encode(this._indexCatalogue));
        var searchQuery = String.format("&searchQuery={0}", Url.encode(query));
        var url = this._resultsUrl + indexCatalogue + searchQuery;

        return url;
    },

    sendSentence: function () {
        if (window.DataIntelligenceSubmitScript) {
            DataIntelligenceSubmitScript._client.sentenceClient.writeSentence({
                predicate: "Search for",
                object: this._searchTextBox.value,
                objectMetadata: [
											{
                                                'K': 'PageUrl',
                                                'V': location.href
                                            }
                ]
            });
        }
    },

    /* -------------------- Event handlers ---------------- */

    _keyPressHandler: function (e) {
        if (!e) var e = window.event;

        var keyCode = null;
        if (e.keyCode) {
            keyCode = e.keyCode;
        }
        else {
            keyCode = e.charCode;
        }

        if (keyCode === 13) {
            this.navigateToResults(e);
        }
    },

    _keyUpHandler: function (e) {
        if (!this._disableSuggestions
            && e.keyCode !== 38 // up arrow
            && e.keyCode !== 40 // down arrow
            && e.keyCode !== 27 // esc
            && e.keyCode !== 13) { // enter
            var request = {};
            var searchText = this._searchTextBox.value.trim();
            if (searchText.length >= this._minSuggestLength) {
                request.IndexName = this.get_indexCatalogue();
                request.SuggestionFields = this._suggestionFields;
                request.Text = searchText;
                request.Language = this._language;
                request.SiteId = this._siteId;

                $.ajax({
                    type: "GET",
                    url: this._suggestionsRoute,
                    dataType: 'json',
                    data: request,
                    success: this._suggestionsSuccessDelegate
                });
            }
        }
        else if (e.keyCode === 13) {
            this.navigateToResults(e);
        }
    },

    _suggestionsSuccess: function (result, args) {
        var dataSource = new kendo.data.DataSource({
            serverFiltering: true,
            data: result.Suggestions
        });

        var autocomplete = $("#" + this._searchTextBox.id).data("kendoAutoComplete");
        autocomplete.setDataSource(dataSource);
        autocomplete.search(this._searchTextBox.value.trim());
    },

    _suggestionSelected: function (event, ui) {
        var text = ui.item.value;
        this._searchTextBox.value = text;

        this.navigateToResults(event);
    },

    _clickHandler: function (e) {
        this.navigateToResults(e);        
    },

    /* -------------------- properties ---------------- */

    get_searchTextBox: function () {
        return this._searchTextBox;
    },
    set_searchTextBox: function (value) {
        this._searchTextBox = value;
    },

    get_searchButton: function () {
        return this._searchButton;
    },
    set_searchButton: function (value) {
        this._searchButton = value;
    },

    get_resultsUrl: function () {
        return this._resultsUrl;
    },
    set_resultsUrl: function (value) {
        this._resultsUrl = value;
    },

    get_indexCatalogue: function () {
        return this._indexCatalogue;
    },
    set_indexCatalogue: function (value) {
        this._indexCatalogue = value;
    },

    get_suggestionFields: function () {
        return this._suggestionFields;
    },
    set_suggestionFields: function (value) {
        this._suggestionFields = value;
    },

    get_suggestionsRoute: function () {
        return this._suggestionsRoute;
    },
    set_suggestionsRoute: function (value) {
        this._suggestionsRoute = value;
    },
    
    get_disableSuggestions: function () {
        return this._disableSuggestions;
    },
    set_disableSuggestions: function (value) {
        this._disableSuggestions = value;
    },

    get_minSuggestLength: function () {
        return this._minSuggestLength;
    },
    set_minSuggestLength: function (value) {
        this._minSuggestLength = value;
    },

    get_language: function () {
        return this._language;
    },
    set_language: function (value) {
        this._language = value;
    },

    get_siteId: function () {
        return this._siteId;
    },
    set_siteId: function (value) {
        this._siteId = value;
    }
};
Telerik.Sitefinity.Services.Search.Web.UI.Public.SearchBox.registerClass("Telerik.Sitefinity.Services.Search.Web.UI.Public.SearchBox", Sys.UI.Control);