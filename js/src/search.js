(function () {
  Well.search = function () {

    $('#search_btn').on('click', function (e) {
      e.preventDefault();
      $('body').addClass('search-on');
      $('.input-field').addClass('active');
      $('#search_input').focus();
    });
    $('#search_input').blur(function () {
      if ($('#search_input').val() === '') {
        $('.input-field').removeClass('active');
      }
    });
    $('.blog-overlay').on('click', function () {
      $('#search_input').val('');
      $('body').removeClass('search-on').removeClass('right-on');
    });
    var searchXml = "search.xml";
    if (searchXml.length == 0) {
      searchXml = "search.xml";
    }
    var searchPath = "/" + searchXml;
    initSearch(searchPath, 'search_input', 'search_result');

    // 初始化搜索与匹配函数
    function initSearch(path, search_id, content_id) {
      'use strict';
      $.ajax({
        url: path,
        dataType: "xml",
        success: function (xmlResponse) {
          // get the contents from search data
          var datas = $("entry", xmlResponse).map(function () {
            return {
              title: $("title", this).text(),
              content: $("content", this).text(),
              url: $("url", this).text()
            };
          }).get();
          var $input = document.getElementById(search_id);
          var $resultContent = document.getElementById(content_id);
          $input.addEventListener('input', function () {
            var str = '<ul class=\"search-result-list\">';
            var keywords = this.value.trim().toLowerCase().split(/[\s\-]+/);
            $resultContent.innerHTML = "";
            if (this.value.trim().length <= 0) {
              return;
            }
            // perform local searching
            datas.forEach(function (data) {
              var isMatch = true;
              var content_index = [];
              var data_title = data.title.trim().toLowerCase();
              var data_content = data.content.trim().replace(/<[^>]+>/g, "").toLowerCase();
              var data_url = data.url;
              var index_title = -1;
              var index_content = -1;
              var first_occur = -1;
              // only match artiles with not empty titles and contents
              if (data_title != '' && data_content != '') {
                keywords.forEach(function (keyword, i) {
                  index_title = data_title.indexOf(keyword);
                  index_content = data_content.indexOf(keyword);
                  if (index_title < 0 && index_content < 0) {
                    isMatch = false;
                  } else {
                    if (index_content < 0) {
                      index_content = 0;
                    }
                    if (i == 0) {
                      first_occur = index_content;
                    }
                  }
                });
              }
              // show search results
              if (isMatch) {
                keywords.forEach(function (keyword) {
                  var regS = new RegExp(keyword, "gi");
                  data_title = data_title.replace(regS, "<span class=\"search-keyword green lighten-2\">" + keyword + "</span>");
                });

                str += "<li><a href='" + data_url + "' class='search-result-title'>" + data_title + "</a>";
                var content = data.content.trim().replace(/<[^>]+>/g, "");
                if (first_occur >= 0) {
                  // cut out 100 characters
                  var start = first_occur - 20;
                  var end = first_occur + 80;
                  if (start < 0) {
                    start = 0;
                  }
                  if (start == 0) {
                    end = 100;
                  }
                  if (end > content.length) {
                    end = content.length;
                  }
                  var match_content = content.substring(start, end);
                  // highlight all keywords
                  keywords.forEach(function (keyword) {
                    var regS = new RegExp(keyword, "gi");
                    match_content = match_content.replace(regS, "<span class=\"search-keyword green lighten-2\">" + keyword + "</span>");
                  });

                  str += "<p>..." + match_content + "...</p>"
                }
                str += "</li>";
              }
            });
            str += "</ul>";
            $resultContent.innerHTML = str;
          });
        }
      });
    }
  }
})();

$(document).ready(function () {
  Well.search();
});