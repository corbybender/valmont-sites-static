function radMenuOnClick(sender,args){var state=args.get_item().get_attributes().getAttribute("ExpandOnClick");
args.get_item().get_attributes().setAttribute("ExpandOnClick","true");
args.get_item().open();
}function radMenuOnOpening(sender,args){var state=args.get_item().get_attributes().getAttribute("ExpandOnClick");
if(state!="true"){args.set_cancel(true);
}args.get_item().get_attributes().setAttribute("ExpandOnClick","false");
}