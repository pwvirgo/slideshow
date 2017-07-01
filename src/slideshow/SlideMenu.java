package slideshow;

import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.util.logging.Level;
import java.util.logging.Logger;
import javax.swing.JMenuItem;
import javax.swing.JOptionPane;
import javax.swing.JPopupMenu;

/**
 *
 * @author pwv
 */
public class SlideMenu extends JPopupMenu {

	Gui gui;
	static final Logger	log = Logger.getLogger( "slideshow.SlideMenu" );
	final dosomething		act = new dosomething();
	final JMenuItem			pause = new JMenuItem("Pause");
	final JMenuItem			resume = new JMenuItem("Resume");
	final JMenuItem			setTiming = new JMenuItem("Set image timing");
	final JMenuItem			back = new JMenuItem("Previous image");
	final JMenuItem			closeMenu = new JMenuItem("Close this menu (ESC)");
	final JMenuItem			getINo = new JMenuItem("image number");
	
	public SlideMenu(Gui gui) {
		log.setLevel(Level.FINER);
		this.gui=gui;
		add(pause);				pause.addActionListener(act);
		add(resume);			resume.addActionListener(act);
		add(setTiming);		setTiming.addActionListener(act);
		add(back);				back.addActionListener(act);
		add(closeMenu);		closeMenu.addActionListener(act);
		add(getINo);
	}
	
	public class dosomething implements ActionListener {
	  final Logger	log2 = Logger.getLogger( "slideshow.SlideMenu" );

		@Override
		public void actionPerformed(ActionEvent e) {
			log2.info( "action performed"); 
			switch (e.getActionCommand()) {
//				case "image number" :
//				{
//						String s = (String)JOptionPane.showInputDialog(
//												gui,
//												"Select an Image number\n",
//												e.getActionCommand(),
//												JOptionPane.QUESTION_MESSAGE,
//												null,  null, "0");
//
//						if (s.chars().allMatch( Character::isDigit ))   ;
//							gui.timer1.setDelay(Integer.parseInt(s));
//						else 
//							JOptionPane.showMessageDialog(gui, s + " is not a positive integer!", 
//											e.getActionCommand(), JOptionPane.ERROR_MESSAGE);
//				}
//					break;
				case "Pause" :
					//gui.timer1.stop();
					break;
				case "Resume" : 
					log.finer("SlideMenu! restart timing");
					gui.timer1.restart();
					break;
				case "Previous image" :
					gui.back();
					break;
				case "Set image timing":

					String s = (String)JOptionPane.showInputDialog(
											gui,
											"Set image timing in milliseconds (positive integer)\n",
											e.getActionCommand(),
											JOptionPane.QUESTION_MESSAGE,
											null,  null, "15000");

					if (s.chars().allMatch( Character::isDigit )) {
						gui.timer1.setDelay(Integer.parseInt(s));
						log2.info("timer.setDelay  set to : " + Integer.parseInt(s));
					}
					else 
						JOptionPane.showMessageDialog(gui, s + " is not a positive integer!", 
										e.getActionCommand(), JOptionPane.ERROR_MESSAGE);
					gui.timer1.restart();
					
					break;
				default: log.warning("SlideMenu! Unknown menu option was selected");
			}
		}
	}
}
