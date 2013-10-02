// Author: Tyler Van Hoomissen <@_ty>
// Version: 0.1
//
// A plugin that columnizes blocks vertically.
// This is a different spin on jQuery isotope,
// but it's better and faster and stronger and harder.
//
// Why is it called Lace? Because lace is sexy,
// just like your new grid is going to be.
//
// Example usage:
//
// The initial call to setup your grid
// $('.grid-container').lace({
//     colWidth: 200,
//     colPadding: 10,
//     selector: '.grid-item',
//     bootstrapped: true,
//     centered: true
// });
//
// Add items to the grid
// $('.grid-container').lace('append', $('<div class="grid-item">'));
//
// Remove items from grid
// $('.grid-container').lace('remove', $('.grid-container').find('.grid-item').first());
(function($, window, document, undefined) {
    'use strict';

    var defaults = {
        cols: 1,                  // How many cols (shouldn't need change)
        colWidth: 0,              // Width of each column
        colPadding: 0,            // Padding between columns
        minCols: 1,               // Minimum amount of cols to go down to
        windowPadding: 50,        // Extra padding around edges for resize
        selector: null,           // Class name of the individual grid items
        bootstrapped: true,       // If true, will move existing items into grid
        centered: false,          // Will apply css width for margin: auto centering
        $centerRefDiv: $(window)  // Which div will be used to calculate width
    };

    var error = function(msg) {
        console.error('[jQuery.lace] ' + msg);
    };

    function Lace(el, options) {
        this.VERSION = '0.1';

        this.$el = $(el);
        this.resizeTimeout = null;
        this.clearerTemplate = '<div class="lace-clearer" style="clear:both">&nbsp</div>';
        this.colTemplate = '<div class="lace-col" data-sort-index="%i"></div>';
        this.clearerClass = '.lace-clearer';
        this.colClass = '.lace-col';

        this.settings = $.extend({}, defaults, options);

        // Setup the column counts
        this.settings.cols = this._getColumnCount();

        this.cache = {
            cols: this._getColumnCount(),
            lastColAppended: null,
            itemIndex: 0
        };

        if (this.settings.selector == null) {
            error('Missing "selector" param');
        }

        if (this.settings.colWidth == 0) {
            error('Missing "colWidth" param');
        }

        if (this.settings.colPadding == null) {
            error('Missing "colPadding" param');
        }

        this._init();
    }

    Lace.prototype = {
        _init: function() {
            this._createColumns();

            // Put the server-side rendered items into
            // their appropriate grid for the first time
            if (this.settings.bootstrapped) {
                var selector = '> ' + this.settings.selector;
                var $items = this.$el.find(selector);
                this._moveItemsIntoCols($items);
                this.evenBottom();
            }

            if (this.settings.centered) {
                this._setContainerWidth();
            }

            // Add the clearer object if not present
            if (!this.$el.find(this.clearerClass).length) {
                this.$el.append(this.clearerTemplate);
            }

            // Setup the resize event
            // TODO: Debounce this without underscore.js
            $(window).on('resize', function() {
                this.resizeTimeout && clearTimeout(this.resizeTimeout);
                this.resizeTimeout = setTimeout(function() {
                    this._resize();
                }.bind(this), 250);
            }.bind(this));

            // If this class is present it means
            // the plugin has been initalized already
            this.$el.addClass('laced');
        },

        // Calculate how many columns there can be
        // inside the container
        _getColumnCount: function() {
            var elWidth;

            if (this.settings.centered) {
                elWidth = this.settings.$centerRefDiv.width() - this.settings.windowPadding;
            } else {
                elWidth = this.$el.width() - this.settings.windowPadding;
            }

            var colWidth = this.settings.colWidth + this.settings.colPadding;
            var answer = Math.floor(elWidth / colWidth);

            // Never go below 1 column
            return (answer < this.settings.minCols) ? this.settings.minCols : answer;
        },

        _getColumnHeights: function() {
            var $cols = this.$el.find(this.colClass);
            if (!$cols.length) return;

            // Make sure they're in the right order
            $cols = this._sortItemsByIndex($cols);

            var heights = [];
            $cols.each(function() {
                heights.push($(this).height());
            });

            var output = {
                highestCol: null,
                highestValue: null,
                shortestCol: null,
                shortestValue: null
            };

            var lastHeight = null;
            $.each(heights, function(i, v) {
                if (lastHeight == null) {
                    lastHeight = v;
                    output.shortestCol = i + 1;
                } else {
                    if (v < lastHeight) {
                        lastHeight = v;
                        output.shortestCol = i + 1;
                    }
                }
            });
            output.shortestValue = lastHeight;

            lastHeight = null;
            $.each(heights, function(i, v) {
                if (lastHeight == null) {
                    lastHeight = v;
                    output.highestCol = i + 1;
                } else {
                    if (v > lastHeight) {
                        lastHeight = v;
                        output.highestCol = i + 1;
                    }
                }
            });
            output.highestValue = lastHeight;

            return {
                $highest: this.$el.find(this.colClass + '[data-sort-index="' + output.highestCol + '"]'),
                highestValue: output.highestValue,
                $shortest: this.$el.find(this.colClass + '[data-sort-index="' + output.shortestCol + '"]'),
                shortestValue: output.shortestValue
            };
        },

        // Compute how wide the container should be
        // in it's current state in pixels.
        _getContainerWidth: function() {
            var colWithPadding = this.settings.colWidth + this.settings.colPadding;
            return (this._getColumnCount() * colWithPadding) - this.settings.colPadding;
        },

        _setContainerWidth: function() {
            this.$el.css('width', this._getContainerWidth());
        },

        _sortItemsByIndex: function($items) {
            return $items.sort(function(a, b) {
                a = parseInt(a.getAttribute('data-sort-index'));
                b = parseInt(b.getAttribute('data-sort-index'));

                // compare
                if (a > b) {
                    return 1;
                } else if (a < b) {
                    return -1;
                } else {
                    return 0;
                }
            });
        },

        // Create the columns
        _createColumns: function() {
            for (var i = this.settings.cols; i > 0; i--) {
                this.$el.prepend(this.colTemplate.replace('%i', i));
            }
        },

        // Move over the items which are rendered onload
        _moveItemsIntoCols: function($items) {
            $.each($items, function(i, item) {
                var $item = $(item);

                // Add the index to the item itself
                $(item).attr('data-sort-index', this.cache.itemIndex);

                var num;

                if (this.cache.lastColAppended) {
                    num = this.cache.lastColAppended % this.settings.cols + 1;
                } else {
                    num = i % this.settings.cols + 1;
                }

                this.cache.lastColAppended = num;

                var $col = this.$el.find('> ' + this.colClass + '[data-sort-index="' + num + '"]');

                $item.appendTo($col);

                this.cache.itemIndex++;
            }.bind(this));
        },

        // Rebuild and calculate the grid,
        // used for resizing and appending/removing, etc
        _reLayout: function() {
            // Move existing items out of cols
            this.$el.find(this.settings.selector).appendTo(this.$el);

            // Remove existing cols
            this.$el.find(this.colClass).remove();

            // Set the container width
            if (this.settings.centered) {
                this._setContainerWidth();
            }

            this._createColumns();

            var $sortedItems = this._sortItemsByIndex(this.$el.find(this.settings.selector));

            this.cache.itemIndex = 0;
            this.cache.lastColAppended = null;
            this._moveItemsIntoCols($sortedItems);
        },

        // Resize the grid for window changes, etc.
        _resize: function() {
            // Do nothing if col count hasn't changed
            if (this.cache.cols == this._getColumnCount()) return;

            // Set the new count
            this.settings.cols = this._getColumnCount();

            // Update the cache
            this.cache.cols = this.settings.cols;

            this._reLayout();
        },

        // Add new items to the grid.
        // Use this for inifinite scroll.
        append: function($items) {
            if (!$items || !$items.length) return;

            // Run evenBottom beforehand because we have
            // a more likely chance that the imgs have loaded
            // so the calculations will be better
            this.evenBottom();
            this._moveItemsIntoCols($items);
        },

        // Remove specific items from the grid.
        remove: function($items) {
            if (!$items || !$items.length) return;

            // Use the loop in case $items is a plain array
            $.each($items, function(i, item) {
                this.$el.find($(item)).remove();
            }.bind(this));

            this._reLayout();
        },

        // Remove all items from the grid safely
        removeAll: function() {
            this.$el.children(':not(' + this.clearerClass + ')').each(function() {
                $(this).remove();
            });

            this._createColumns();
        },

        // EXPERIMENTAL!
        // Evens out the bottom row.
        evenBottom: function() {
            var $items = this.$el.find(this.settings.selector);
            if (!$items.length) return;

            // Check if the difference between the highest and the
            // shortest columns are big enough. If they're not
            // we don't care about trying to make it more even because
            // it might make it worse
            var $cols = this._getColumnHeights();
            if (Math.abs($cols.highestValue - $cols.shortestValue) <= 500) return;
            if ($items.length == 1) return;

            var i = 0;
            while (i < Math.ceil(this.cache.cols / 2)) {
                $cols = this._getColumnHeights();

                // Pick from the highest, move to the shortest
                var $item = $cols.$highest.find(this.settings.selector).last();
                if ($item.length) {
                    $cols.$shortest.append($item);
                }

                i++;
            }
        }
    };

    $.fn.lace = function(options) {
        var args = Array.prototype.slice.call(arguments, 1);

        this.each(function() {
            var instance = $(this).data('lace');

            if (typeof(options) === 'string') {
                if (!instance) {
                    error('Methods cannot be called before init');
                }
                else if (!$.isFunction(instance[options])) {
                    error('The method "' + options + '" does not exist');
                }
                else {
                    instance[options].apply(instance, args);
                }
            } else {
                if (!instance) {
                    $(this).data('lace', new Lace(this, options));
                }
            }
        });

        return this;
    };
})(jQuery, window, document);
