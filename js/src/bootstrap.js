$(document).ready(function () {
  Well.backToTop();
  Well.mobileNavbar();

  CONFIG.toc && Well.toc();
  CONFIG.fancybox && Well.fancybox();
});
